import {
  AssessmentChannel,
  ConfigKind,
  ConstitutionType,
  ReportTier,
  ReportType,
  type AdvicePart,
  type AssembleReportInput,
  type ConstitutionResult,
  type ExportImageResult,
  type Report,
  type ReportPayload,
  type ShareLinkResult,
} from '@tizhice/shared';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import type { AssessmentService } from '../assessment/assessment.service';
import { channelToReportType, disclaimerText, type ReportTemplatePayload } from './report.fixtures';
import type { InMemoryReportRepository } from './in-memory-report.repository';

interface ReportServiceDependencies {
  configService: ConfigVersionService;
  assessmentService: AssessmentService;
  repository: InMemoryReportRepository;
  publicBaseUrl?: string;
  shareTtlMs?: number;
}

export class ReportAccessDeniedError extends Error {
  static override readonly name = 'ReportAccessDeniedError';
  override readonly name = ReportAccessDeniedError.name;
}

export class ReportService {
  private readonly publicBaseUrl: string;
  private readonly shareTtlMs: number;

  constructor(private readonly dependencies: ReportServiceDependencies) {
    this.publicBaseUrl = dependencies.publicBaseUrl ?? 'https://tizhice.cn';
    this.shareTtlMs = dependencies.shareTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  }

  async assemble(input: AssembleReportInput): Promise<Report> {
    const session = await this.dependencies.assessmentService.getSession(input.sessionId);
    const config = await this.getActiveTemplatePayload();
    const type = channelToReportType(session.channel);
    const payload =
      type === ReportType.CONSTITUTION
        ? await this.assembleConstitutionPayload(input.resultId, config)
        : await this.assemblePainPayload(input.resultId, config);
    const report: Report = {
      id: this.dependencies.repository.nextReportId(),
      userId: session.userId,
      sessionId: session.id,
      type,
      tier: ReportTier.BASIC,
      templateVersion: config.version,
      payload,
      createdAt: new Date(),
    };
    await this.dependencies.repository.saveReport(report);
    return maskReport(report, false);
  }

  async getReport(reportId: string, viewerUserId?: string): Promise<Report> {
    const report = await this.dependencies.repository.getReportOrThrow(reportId);
    assertViewerCanRead(report, viewerUserId);
    const canSeeDeep = await this.dependencies.repository.hasDeepAccess(reportId, viewerUserId);
    return maskReport(report, canSeeDeep);
  }

  async listMyReports(userId: string): Promise<Report[]> {
    const reports = await this.dependencies.repository.listReportsByUser(userId);
    return Promise.all(reports.map((report) => this.getReport(report.id, userId)));
  }

  async generateShareLink(reportId: string, userId: string): Promise<ShareLinkResult> {
    const report = await this.dependencies.repository.getReportOrThrow(reportId);
    assertOwner(report, userId);
    const expiresAt = new Date(Date.now() + this.shareTtlMs);
    const url = `${this.publicBaseUrl.replace(/\/$/, '')}/reports/share/${encodeURIComponent(
      reportId,
    )}?exp=${expiresAt.getTime()}`;
    const link = { url, expiresAt };
    await this.dependencies.repository.saveShareLink({ ...link, reportId, userId });
    return link;
  }

  async exportAsImage(reportId: string, userId: string): Promise<ExportImageResult> {
    const report = await this.dependencies.repository.getReportOrThrow(reportId);
    assertOwner(report, userId);
    const jobId = this.dependencies.repository.nextExportJobId();
    return this.dependencies.repository.enqueueExportJob({
      id: jobId,
      reportId,
      userId,
      status: 'QUEUED',
      attempts: 0,
      createdAt: new Date(),
    });
  }

  async grantDeepAccess(reportId: string, userId: string, orderId: string): Promise<void> {
    const report = await this.dependencies.repository.getReportOrThrow(reportId);
    assertOwner(report, userId);
    await this.dependencies.repository.grantDeepAccess({
      reportId,
      userId,
      orderId,
      grantedAt: new Date(),
    });
  }

  async revokeDeepAccess(reportId: string, userId: string): Promise<void> {
    const report = await this.dependencies.repository.getReportOrThrow(reportId);
    assertOwner(report, userId);
    await this.dependencies.repository.revokeDeepAccess(reportId, userId);
  }

  private async assembleConstitutionPayload(
    resultId: string,
    config: ReportTemplatePayload,
  ): Promise<ReportPayload> {
    const result = await this.dependencies.assessmentService.getConstitutionResult(resultId);
    const primary = result.primary;
    const primaryAdvice = advice(primary, config);
    const concurrentAdvice = concurrentAdviceByPriority(result, config);

    return {
      overview: fragmentText(config, `${primary}_overview`),
      interpretation: fragmentText(config, `${primary}_interpretation`),
      kitchen: {
        forPrimary: primaryAdvice.kitchen,
        forConcurrent: concurrentAdvice.kitchen,
      },
      lifestyle: {
        forPrimary: primaryAdvice.lifestyle,
        forConcurrent: concurrentAdvice.lifestyle,
      },
      medicalHint: {
        generic: [fragmentText(config, `${primary}_medical`)],
      },
      disclaimer: disclaimerText(),
      deep: {
        masked: false,
        preview: config.deepPreview,
        full: [
          {
            forPrimary: [fragmentText(config, `${primary}_deep_kitchen`)],
            forConcurrent: concurrentAdvice.deepKitchen,
          },
          {
            forPrimary: [fragmentText(config, `${primary}_deep_lifestyle`)],
            forConcurrent: concurrentAdvice.deepLifestyle,
          },
        ],
      },
    };
  }

  private async assemblePainPayload(
    resultId: string,
    config: ReportTemplatePayload,
  ): Promise<ReportPayload> {
    const pain = await this.dependencies.assessmentService.getPainResult(resultId);
    const severity = pain.severity ?? 0;
    const urgent = pain.redFlagLevel === 'URGENT';
    return {
      overview: `${fragmentText(config, 'pain_overview')} 疼痛强度：${severity}/10。`,
      interpretation: fragmentText(config, 'pain_interpretation'),
      kitchen: { generic: [fragmentText(config, 'pain_kitchen')] },
      lifestyle: { generic: [fragmentText(config, 'pain_lifestyle')] },
      medicalHint: {
        generic: [
          urgent
            ? '命中红旗征：请尽快就医。本提示为健康风险提醒，非诊断。'
            : fragmentText(config, 'pain_medical'),
        ],
      },
      disclaimer: disclaimerText(),
      deep: {
        masked: false,
        preview: config.deepPreview,
        full: [{ generic: [fragmentText(config, 'pain_deep_lifestyle')] }],
      },
    };
  }

  private async getActiveTemplatePayload(): Promise<ReportTemplatePayload> {
    return (await this.dependencies.configService.getActive(ConfigKind.REPORT_TEMPLATE))
      .payload as ReportTemplatePayload;
  }
}

function advice(
  type: ConstitutionType,
  config: ReportTemplatePayload,
): { kitchen: string[]; lifestyle: string[] } {
  return {
    kitchen: [fragmentText(config, `${type}_kitchen`)],
    lifestyle: [fragmentText(config, `${type}_lifestyle`)],
  };
}

function concurrentAdviceByPriority(
  result: ConstitutionResult,
  config: ReportTemplatePayload,
): {
  kitchen: Partial<Record<ConstitutionType, string[]>>;
  lifestyle: Partial<Record<ConstitutionType, string[]>>;
  deepKitchen: Partial<Record<ConstitutionType, string[]>>;
  deepLifestyle: Partial<Record<ConstitutionType, string[]>>;
} {
  const sorted = [...result.concurrent].sort(
    (left, right) => scoreOf(result, right) - scoreOf(result, left),
  );
  const kitchen: Partial<Record<ConstitutionType, string[]>> = {};
  const lifestyle: Partial<Record<ConstitutionType, string[]>> = {};
  const deepKitchen: Partial<Record<ConstitutionType, string[]>> = {};
  const deepLifestyle: Partial<Record<ConstitutionType, string[]>> = {};
  for (const type of sorted) {
    kitchen[type] = [fragmentText(config, `${type}_kitchen`)];
    lifestyle[type] = [fragmentText(config, `${type}_lifestyle`)];
    deepKitchen[type] = [fragmentText(config, `${type}_deep_kitchen`)];
    deepLifestyle[type] = [fragmentText(config, `${type}_deep_lifestyle`)];
  }
  return { kitchen, lifestyle, deepKitchen, deepLifestyle };
}

function scoreOf(result: ConstitutionResult, type: ConstitutionType): number {
  return result.scores.find((score) => score.type === type)?.convertedScore ?? 0;
}

function fragmentText(config: ReportTemplatePayload, id: string): string {
  const fragment = config.fragments[id];
  if (!fragment) {
    throw new Error(`Report fragment not found: ${id}`);
  }
  return fragment.content.join('\n');
}

function assertViewerCanRead(report: Report, viewerUserId?: string): void {
  if (report.userId && report.userId !== viewerUserId) {
    throw new ReportAccessDeniedError('Cannot read another user report');
  }
}

function assertOwner(report: Report, userId: string): void {
  if (report.userId !== userId) {
    throw new ReportAccessDeniedError('Only report owner can perform this operation');
  }
}

function maskReport(report: Report, canSeeDeep: boolean): Report {
  const cloned = cloneReport(report);
  cloned.tier = canSeeDeep ? ReportTier.DEEP : ReportTier.BASIC;
  if (cloned.payload.deep) {
    cloned.payload.deep = canSeeDeep
      ? { ...cloned.payload.deep, masked: false }
      : {
          masked: true,
          preview: cloned.payload.deep.preview,
        };
  }
  return cloned;
}

function cloneReport(report: Report): Report {
  return {
    ...report,
    createdAt: new Date(report.createdAt),
    payload: JSON.parse(JSON.stringify(report.payload)) as ReportPayload,
  };
}

export function reportTypeForChannel(channel: AssessmentChannel): ReportType {
  return channelToReportType(channel);
}

export function maskDeepPayloadForTest(
  report: Report,
  canSeeDeep: boolean,
): AdvicePart[] | undefined {
  return maskReport(report, canSeeDeep).payload.deep?.full;
}

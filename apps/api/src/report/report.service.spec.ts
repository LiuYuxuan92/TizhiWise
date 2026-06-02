import { describe, expect, it } from 'vitest';
import {
  AssessmentChannel,
  ConfigKind,
  ConstitutionType,
  Gender,
  ReportTier,
  ReportType,
} from '@tizhice/shared';
import { AssessmentService } from '../assessment/assessment.service';
import { InMemoryAssessmentRepository } from '../assessment/in-memory-assessment.repository';
import { defaultQuestionBank } from '../assessment/question-bank.fixtures';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import {
  buildAlgorithmConfig,
  buildAnswersForScores,
} from '../constitution/constitution-test-fixtures';
import { InMemoryAlgorithmConfigRepository } from '../constitution/in-memory-algorithm-config.repository';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import { InMemoryReportRepository } from './in-memory-report.repository';
import { defaultReportTemplatePayload } from './report.fixtures';
import { ReportAccessDeniedError, ReportService } from './report.service';

describe('ReportService', () => {
  it('assembles a constitution report with basic content, disclaimer and masked deep preview', async () => {
    const { reportService, assessmentService, algorithmConfig } = await createServices();
    const finalized = await finalizeConstitution(assessmentService, algorithmConfig, 'user-r6');

    const report = await reportService.assemble(finalized);

    expect(report).toMatchObject({
      userId: 'user-r6',
      type: ReportType.CONSTITUTION,
      tier: ReportTier.BASIC,
      templateVersion: 'v1',
    });
    expect(report.payload.overview).toContain(ConstitutionType.QIXU);
    expect(report.payload.disclaimer).toContain('不构成医疗诊断');
    expect(report.payload.kitchen.forPrimary?.[0]).toContain(ConstitutionType.QIXU);
    expect(report.payload.deep?.masked).toBe(true);
    expect(report.payload.deep?.preview.titles.length).toBeGreaterThan(0);
    expect(report.payload.deep?.full).toBeUndefined();
  });

  it('unmasks deep report only after server-side grantDeepAccess for the report owner', async () => {
    const { reportService, assessmentService, algorithmConfig } = await createServices();
    const finalized = await finalizeConstitution(assessmentService, algorithmConfig, 'user-paid');
    const report = await reportService.assemble(finalized);

    await expect(reportService.getReport(report.id, 'user-paid')).resolves.toMatchObject({
      tier: ReportTier.BASIC,
      payload: { deep: { masked: true } },
    });

    await reportService.grantDeepAccess(report.id, 'user-paid', 'order-1');

    const paid = await reportService.getReport(report.id, 'user-paid');
    expect(paid.tier).toBe(ReportTier.DEEP);
    expect(paid.payload.deep?.masked).toBe(false);
    expect(paid.payload.deep?.full?.[0]?.forPrimary?.[0]).toContain('深度饮食建议');
  });

  it('blocks another user from reading, sharing, exporting or granting access to the report', async () => {
    const { reportService, assessmentService, algorithmConfig } = await createServices();
    const finalized = await finalizeConstitution(assessmentService, algorithmConfig, 'owner');
    const report = await reportService.assemble(finalized);

    await expect(reportService.getReport(report.id, 'intruder')).rejects.toBeInstanceOf(
      ReportAccessDeniedError,
    );
    await expect(reportService.generateShareLink(report.id, 'intruder')).rejects.toBeInstanceOf(
      ReportAccessDeniedError,
    );
    await expect(reportService.exportAsImage(report.id, 'intruder')).rejects.toBeInstanceOf(
      ReportAccessDeniedError,
    );
    await expect(
      reportService.grantDeepAccess(report.id, 'intruder', 'order-intruder'),
    ).rejects.toBeInstanceOf(ReportAccessDeniedError);
  });

  it('lists only my historical reports and applies per-report paid visibility', async () => {
    const { reportService, assessmentService, algorithmConfig } = await createServices();
    const mineA = await reportService.assemble(
      await finalizeConstitution(assessmentService, algorithmConfig, 'user-history'),
    );
    const mineB = await reportService.assemble(
      await finalizeConstitution(assessmentService, algorithmConfig, 'user-history'),
    );
    await reportService.assemble(
      await finalizeConstitution(assessmentService, algorithmConfig, 'other-user'),
    );
    await reportService.grantDeepAccess(mineA.id, 'user-history', 'order-history');

    const reports = await reportService.listMyReports('user-history');

    expect(reports.map((report) => report.id).sort()).toEqual([mineA.id, mineB.id].sort());
    expect(reports.find((report) => report.id === mineA.id)?.tier).toBe(ReportTier.DEEP);
    expect(reports.find((report) => report.id === mineB.id)?.tier).toBe(ReportTier.BASIC);
  });

  it('creates expiring share links and queued image export jobs for the owner', async () => {
    const { reportService, reportRepository, assessmentService, algorithmConfig } =
      await createServices();
    const finalized = await finalizeConstitution(assessmentService, algorithmConfig, 'user-share');
    const report = await reportService.assemble(finalized);

    const share = await reportService.generateShareLink(report.id, 'user-share');
    const exportResult = await reportService.exportAsImage(report.id, 'user-share');

    expect(share.url).toContain(`/reports/share/${report.id}`);
    expect(share.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(exportResult.imageUrl).toMatch(/^queued:\/\/report-export-/);
    await expect(reportRepository.listExportJobs()).resolves.toEqual([
      expect.objectContaining({
        reportId: report.id,
        userId: 'user-share',
        status: 'QUEUED',
        attempts: 0,
      }),
    ]);
  });

  it('assembles pain reports with red-flag medical hint and non-diagnostic disclaimer', async () => {
    const { reportService, assessmentService } = await createServices();
    const finalized = await finalizePain(assessmentService, 'pain-user');

    const report = await reportService.assemble(finalized);

    expect(report.type).toBe(ReportType.PAIN);
    expect(report.payload.overview).toContain('疼痛强度：9/10');
    expect(report.payload.medicalHint?.generic?.[0]).toContain('红旗征');
    expect(report.payload.medicalHint?.generic?.[0]).toContain('非诊断');
    expect(report.payload.disclaimer).toContain('不构成医疗诊断');
  });
});

async function createServices() {
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  const algorithmConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
  await configService.publish(
    ConfigKind.QUESTION_BANK,
    defaultQuestionBank(algorithmConfig),
    'seed',
  );
  await configService.publish(ConfigKind.ALGORITHM, algorithmConfig, 'seed');
  await configService.publish(ConfigKind.REPORT_TEMPLATE, defaultReportTemplatePayload(), 'seed');

  const assessmentRepository = new InMemoryAssessmentRepository();
  const assessmentService = new AssessmentService({
    configService,
    algorithmService: new ConstitutionAlgoService(
      new InMemoryAlgorithmConfigRepository([algorithmConfig]),
    ),
    repository: assessmentRepository,
  });
  const reportRepository = new InMemoryReportRepository();
  const reportService = new ReportService({
    configService,
    assessmentService,
    repository: reportRepository,
  });
  return { reportService, reportRepository, assessmentService, algorithmConfig };
}

async function finalizeConstitution(
  assessmentService: AssessmentService,
  algorithmConfig: ReturnType<typeof buildAlgorithmConfig>,
  userId: string,
) {
  const { sessionId } = await assessmentService.createSession({
    userId,
    channel: AssessmentChannel.CONSTITUTION,
    baseProfile: { gender: Gender.F, ageBand: '26-35' },
  });
  const answers = buildAnswersForScores(algorithmConfig, {
    PINGHE: [1, 1],
    QIXU: [5, 5],
    YANGXU: [4, 4],
    YINXU: [3, 3],
  });
  for (const answer of answers) {
    await assessmentService.submitAnswer({
      sessionId,
      questionId: answer.questionId,
      value: answer.score,
    });
  }
  const finalized = await assessmentService.finalize(sessionId);
  return { sessionId, resultId: finalized.resultId };
}

async function finalizePain(assessmentService: AssessmentService, userId: string) {
  const { sessionId } = await assessmentService.createSession({
    userId,
    channel: AssessmentChannel.PAIN,
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_area',
    value: ['neck'],
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_nature',
    value: ['sharp'],
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_duration',
    value: 'over_72h',
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_trigger',
    value: ['night'],
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_severity',
    value: 9,
  });
  await assessmentService.submitAnswer({
    sessionId,
    questionId: 'pain_neuro',
    value: ['weakness'],
  });
  const finalized = await assessmentService.finalize(sessionId);
  return { sessionId, resultId: finalized.resultId };
}

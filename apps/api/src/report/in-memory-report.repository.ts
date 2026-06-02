import type { ExportImageResult, Report, ShareLinkResult } from '@tizhice/shared';

export interface ReportAccessGrant {
  reportId: string;
  userId: string;
  orderId: string;
  grantedAt: Date;
  revokedAt?: Date;
}

export interface StoredExportJob {
  id: string;
  reportId: string;
  userId: string;
  status: 'QUEUED' | 'COMPLETED' | 'FAILED';
  attempts: number;
  imageUrl?: string;
  createdAt: Date;
}

export interface StoredShareLink extends ShareLinkResult {
  reportId: string;
  userId: string;
}

export class InMemoryReportRepository {
  private reportCounter = 0;
  private exportCounter = 0;
  private readonly reports = new Map<string, Report>();
  private readonly accessGrants = new Map<string, ReportAccessGrant>();
  private readonly shareLinks = new Map<string, StoredShareLink>();
  private readonly exportJobs = new Map<string, StoredExportJob>();

  nextReportId(): string {
    this.reportCounter += 1;
    return `report-${this.reportCounter}`;
  }

  nextExportJobId(): string {
    this.exportCounter += 1;
    return `report-export-${this.exportCounter}`;
  }

  async saveReport(report: Report): Promise<void> {
    this.reports.set(report.id, cloneReport(report));
  }

  async getReportOrThrow(reportId: string): Promise<Report> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    return cloneReport(report);
  }

  async listReportsByUser(userId: string): Promise<Report[]> {
    return [...this.reports.values()]
      .filter((report) => report.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(cloneReport);
  }

  async mergeAnonymousReports(userId: string, sessionIds: readonly string[]): Promise<number> {
    const sessionSet = new Set(sessionIds);
    let merged = 0;
    for (const report of this.reports.values()) {
      if (sessionSet.has(report.sessionId) && report.userId !== userId) {
        report.userId = userId;
        merged += 1;
      }
    }
    return merged;
  }

  async anonymizeUserReports(userId: string, anonymizedUserId: string): Promise<number> {
    let changed = 0;
    for (const report of this.reports.values()) {
      if (report.userId === userId) {
        report.userId = anonymizedUserId;
        changed += 1;
      }
    }
    for (const [key, grant] of this.accessGrants.entries()) {
      if (grant.userId === userId) {
        this.accessGrants.set(key, {
          ...cloneGrant(grant),
          userId: anonymizedUserId,
          revokedAt: grant.revokedAt ?? new Date(),
        });
      }
    }
    return changed;
  }

  async grantDeepAccess(grant: ReportAccessGrant): Promise<void> {
    this.accessGrants.set(accessKey(grant.reportId, grant.userId), cloneGrant(grant));
  }

  async revokeDeepAccess(reportId: string, userId: string): Promise<void> {
    const key = accessKey(reportId, userId);
    const grant = this.accessGrants.get(key);
    if (grant) {
      this.accessGrants.set(key, { ...cloneGrant(grant), revokedAt: new Date() });
    }
  }

  async hasDeepAccess(reportId: string, userId?: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const grant = this.accessGrants.get(accessKey(reportId, userId));
    return Boolean(grant && !grant.revokedAt);
  }

  async saveShareLink(link: StoredShareLink): Promise<void> {
    this.shareLinks.set(link.url, cloneShareLink(link));
  }

  async getShareLink(url: string): Promise<StoredShareLink | undefined> {
    const link = this.shareLinks.get(url);
    return link ? cloneShareLink(link) : undefined;
  }

  async enqueueExportJob(job: StoredExportJob): Promise<ExportImageResult> {
    this.exportJobs.set(job.id, cloneExportJob(job));
    return { imageUrl: job.imageUrl ?? `queued://${job.id}` };
  }

  async listExportJobs(): Promise<StoredExportJob[]> {
    return [...this.exportJobs.values()].map(cloneExportJob);
  }
}

function accessKey(reportId: string, userId: string): string {
  return `${reportId}:${userId}`;
}

function cloneReport(report: Report): Report {
  return {
    ...report,
    createdAt: new Date(report.createdAt),
    payload: structuredCloneFallback(report.payload),
  };
}

function cloneGrant(grant: ReportAccessGrant): ReportAccessGrant {
  return {
    ...grant,
    grantedAt: new Date(grant.grantedAt),
    revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : undefined,
  };
}

function cloneShareLink(link: StoredShareLink): StoredShareLink {
  return {
    ...link,
    expiresAt: new Date(link.expiresAt),
  };
}

function cloneExportJob(job: StoredExportJob): StoredExportJob {
  return {
    ...job,
    createdAt: new Date(job.createdAt),
  };
}

function structuredCloneFallback<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

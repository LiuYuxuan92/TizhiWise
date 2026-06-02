import {
  ContentStatus,
  PublishMethod,
  type ContentDraft,
  type EditDraftInput,
  type ListDraftsFilters,
  type PaginatedList,
  type PublishDraftInput,
  type PublishDraftResult,
} from '@tizhice/shared';
import { InMemoryContentAiRepository } from '../content-ai/in-memory-content-ai.repository';

interface ContentMgmtServiceDependencies {
  repository: InMemoryContentAiRepository;
  now?: () => Date;
}

interface DraftListQuery extends ListDraftsFilters {
  page?: number;
  pageSize?: number;
}

interface ReviewInput {
  operator: string;
  confirmRisk?: boolean;
}

export class ContentMgmtService {
  private versionCounter = 0;

  constructor(private readonly dependencies: ContentMgmtServiceDependencies) {}

  async listDrafts(filters: DraftListQuery = {}): Promise<PaginatedList<ContentDraft>> {
    return this.dependencies.repository.listDrafts(filters);
  }

  async getDraft(draftId: string): Promise<ContentDraft> {
    return this.dependencies.repository.getDraftOrThrow(draftId);
  }

  async editDraft(draftId: string, input: EditDraftInput): Promise<ContentDraft> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    assertEditable(draft);
    const editedAt = this.now();
    const next: ContentDraft = {
      ...draft,
      title: input.title ?? draft.title,
      body: input.body ?? draft.body,
      scriptStoryboard:
        input.scriptStoryboard === undefined ? draft.scriptStoryboard : input.scriptStoryboard,
      tags: input.tags ? [...input.tags] : [...draft.tags],
    };
    next.versions = [
      ...draft.versions,
      {
        versionId: this.nextVersionId(),
        editedBy: input.editedBy,
        editedAt,
        diff: buildDiff(draft, next),
      },
    ];
    await this.dependencies.repository.updateDraft(next);
    return next;
  }

  async submitForReview(draftId: string, input: ReviewInput): Promise<ContentDraft> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    if (draft.status === ContentStatus.RISK_FLAGGED && !input.confirmRisk) {
      throw new Error('Risk flagged content requires manual confirmation before review');
    }
    if (draft.status !== ContentStatus.DRAFT && draft.status !== ContentStatus.RISK_FLAGGED) {
      throw new Error(`Cannot submit draft in ${draft.status} status for review`);
    }
    const next = {
      ...draft,
      status: ContentStatus.PENDING_REVIEW,
      versions: [
        ...draft.versions,
        {
          versionId: this.nextVersionId(),
          editedBy: input.operator,
          editedAt: this.now(),
          diff:
            draft.status === ContentStatus.RISK_FLAGGED
              ? 'Manual compliance-risk confirmation before review'
              : 'Submitted for review',
        },
      ],
    };
    await this.dependencies.repository.updateDraft(next);
    return next;
  }

  async approve(draftId: string, approver: string): Promise<void> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    if (draft.status === ContentStatus.RISK_FLAGGED) {
      throw new Error('Risk flagged content must be manually confirmed before approval');
    }
    if (draft.status !== ContentStatus.PENDING_REVIEW) {
      throw new Error(`Cannot approve draft in ${draft.status} status`);
    }
    await this.dependencies.repository.updateDraft({
      ...draft,
      status: ContentStatus.APPROVED,
      versions: [
        ...draft.versions,
        {
          versionId: this.nextVersionId(),
          editedBy: approver,
          editedAt: this.now(),
          diff: 'Approved for publishing',
        },
      ],
    });
  }

  async reject(draftId: string, approver: string, reason: string): Promise<void> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    if (draft.status !== ContentStatus.PENDING_REVIEW) {
      throw new Error(`Cannot reject draft in ${draft.status} status`);
    }
    await this.dependencies.repository.updateDraft({
      ...draft,
      status: ContentStatus.DRAFT,
      versions: [
        ...draft.versions,
        {
          versionId: this.nextVersionId(),
          editedBy: approver,
          editedAt: this.now(),
          diff: `Rejected: ${reason}`,
        },
      ],
    });
  }

  async publish(draftId: string, input: PublishDraftInput): Promise<PublishDraftResult> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    if (draft.status !== ContentStatus.APPROVED) {
      throw new Error(`Cannot publish draft in ${draft.status} status`);
    }
    const publishedAt = input.scheduledAt ?? this.now();
    const publishRef =
      input.method === PublishMethod.API
        ? `platform:${draft.platform.toLowerCase()}:${draft.id}:${publishedAt.getTime()}`
        : undefined;
    const exportUrl =
      input.method === PublishMethod.EXPORT
        ? `/exports/content/${draft.id}-${publishedAt.getTime()}.json`
        : undefined;
    await this.dependencies.repository.updateDraft({
      ...draft,
      status: ContentStatus.PUBLISHED,
      publishedAt,
      publishedBy: input.operator,
      publishedPlatform: draft.platform,
      versions: [
        ...draft.versions,
        {
          versionId: this.nextVersionId(),
          editedBy: input.operator,
          editedAt: this.now(),
          diff:
            input.method === PublishMethod.API
              ? `Published via platform API: ${publishRef}`
              : `Exported for manual publishing: ${exportUrl}`,
        },
      ],
    });
    return { publishRef, exportUrl };
  }

  async markDiscarded(draftId: string, operator: string): Promise<void> {
    const draft = await this.dependencies.repository.getDraftOrThrow(draftId);
    if (draft.status === ContentStatus.PUBLISHED) {
      throw new Error('Published content cannot be discarded');
    }
    if (draft.status === ContentStatus.DISCARDED) {
      return;
    }
    await this.dependencies.repository.updateDraft({
      ...draft,
      status: ContentStatus.DISCARDED,
      versions: [
        ...draft.versions,
        {
          versionId: this.nextVersionId(),
          editedBy: operator,
          editedAt: this.now(),
          diff: 'Discarded',
        },
      ],
    });
  }

  private nextVersionId(): string {
    this.versionCounter += 1;
    return `content-version-${this.versionCounter}`;
  }

  private now(): Date {
    return new Date((this.dependencies.now?.() ?? new Date()).getTime());
  }
}

function assertEditable(draft: ContentDraft): void {
  if (draft.status === ContentStatus.PUBLISHED || draft.status === ContentStatus.DISCARDED) {
    throw new Error(`Cannot edit draft in ${draft.status} status`);
  }
}

function buildDiff(before: ContentDraft, after: ContentDraft): string {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  if (before.title !== after.title) {
    changes.title = { before: before.title, after: after.title };
  }
  if (before.body !== after.body) {
    changes.body = { before: before.body, after: after.body };
  }
  if (
    JSON.stringify(before.scriptStoryboard ?? null) !==
    JSON.stringify(after.scriptStoryboard ?? null)
  ) {
    changes.scriptStoryboard = {
      before: before.scriptStoryboard ?? null,
      after: after.scriptStoryboard ?? null,
    };
  }
  if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
    changes.tags = { before: before.tags, after: after.tags };
  }
  return JSON.stringify(changes);
}

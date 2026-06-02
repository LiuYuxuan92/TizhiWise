import { describe, expect, it } from 'vitest';
import { ContentStatus, Platform, PublishMethod, type ContentDraft } from '@tizhice/shared';
import { InMemoryContentAiRepository } from '../content-ai/in-memory-content-ai.repository';
import { ContentMgmtService } from './content-mgmt.service';

describe('ContentMgmtService', () => {
  it('lists drafts by platform, status, date and tags with pagination', async () => {
    const { repository, service } = createService();
    await repository.saveDraft(
      draft({ id: 'd-1', platform: Platform.XIAOHONGSHU, tags: ['气虚'] }),
    );
    await repository.saveDraft(
      draft({
        id: 'd-2',
        platform: Platform.VIDEO_CHANNEL,
        status: ContentStatus.PENDING_REVIEW,
        tags: ['气虚', '视频'],
        createdAt: new Date('2026-02-02T00:00:00Z'),
      }),
    );
    await repository.saveDraft(
      draft({
        id: 'd-3',
        platform: Platform.VIDEO_CHANNEL,
        tags: ['湿热'],
        createdAt: new Date('2026-03-03T00:00:00Z'),
      }),
    );

    await expect(
      service.listDrafts({
        platform: Platform.VIDEO_CHANNEL,
        dateRange: [new Date('2026-02-01T00:00:00Z'), new Date('2026-03-01T00:00:00Z')],
        tags: ['气虚'],
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: 'd-2' })],
    });
  });

  it('edits draft content and appends version diff history', async () => {
    const { repository, service } = createService();
    await repository.saveDraft(draft({ id: 'd-edit', title: '旧标题', body: '旧正文' }));

    const edited = await service.editDraft('d-edit', {
      title: '新标题',
      body: '新正文',
      tags: ['痰湿质', '厨房优先'],
      editedBy: 'operator-1',
    });

    expect(edited.title).toBe('新标题');
    expect(edited.tags).toEqual(['痰湿质', '厨房优先']);
    expect(edited.versions).toHaveLength(1);
    expect(edited.versions[0]).toMatchObject({ editedBy: 'operator-1' });
    expect(edited.versions[0]?.diff).toContain('旧标题');
    await expect(service.getDraft('d-edit')).resolves.toMatchObject({
      title: '新标题',
      versions: expect.arrayContaining([expect.objectContaining({ editedBy: 'operator-1' })]),
    });
  });

  it('requires manual confirmation for risk-flagged drafts before review and approval', async () => {
    const { repository, service } = createService();
    await repository.saveDraft(
      draft({
        id: 'd-risk',
        status: ContentStatus.RISK_FLAGGED,
        complianceFlags: ['MEDICAL_OR_ABSOLUTE_CLAIM'],
      }),
    );

    await expect(
      service.submitForReview('d-risk', { operator: 'ops', confirmRisk: false }),
    ).rejects.toThrow(/requires manual confirmation/);
    await expect(service.approve('d-risk', 'reviewer')).rejects.toThrow(/manually confirmed/);

    const pending = await service.submitForReview('d-risk', {
      operator: 'ops',
      confirmRisk: true,
    });
    expect(pending.status).toBe(ContentStatus.PENDING_REVIEW);

    await service.approve('d-risk', 'reviewer');
    await expect(service.getDraft('d-risk')).resolves.toMatchObject({
      status: ContentStatus.APPROVED,
    });
  });

  it('supports reject, discard, API publish and manual export state transitions', async () => {
    const { repository, service } = createService();
    await repository.saveDraft(draft({ id: 'd-reject' }));
    await repository.saveDraft(draft({ id: 'd-api', platform: Platform.MOMENTS }));
    await repository.saveDraft(draft({ id: 'd-export', platform: Platform.VIDEO_CHANNEL }));
    await repository.saveDraft(draft({ id: 'd-discard' }));

    await service.submitForReview('d-reject', { operator: 'ops' });
    await service.reject('d-reject', 'reviewer', '需要补充免责声明');
    await expect(service.getDraft('d-reject')).resolves.toMatchObject({
      status: ContentStatus.DRAFT,
      versions: expect.arrayContaining([
        expect.objectContaining({ diff: expect.stringContaining('Rejected') }),
      ]),
    });

    await service.submitForReview('d-api', { operator: 'ops' });
    await service.approve('d-api', 'reviewer');
    const apiResult = await service.publish('d-api', {
      operator: 'publisher',
      method: PublishMethod.API,
    });
    expect(apiResult.publishRef).toContain('platform:moments:d-api');
    await expect(service.getDraft('d-api')).resolves.toMatchObject({
      status: ContentStatus.PUBLISHED,
      publishedBy: 'publisher',
      publishedPlatform: Platform.MOMENTS,
    });

    await service.submitForReview('d-export', { operator: 'ops' });
    await service.approve('d-export', 'reviewer');
    const exportResult = await service.publish('d-export', {
      operator: 'publisher',
      method: PublishMethod.EXPORT,
    });
    expect(exportResult.exportUrl).toContain('/exports/content/d-export-');

    await service.markDiscarded('d-discard', 'ops');
    await expect(service.getDraft('d-discard')).resolves.toMatchObject({
      status: ContentStatus.DISCARDED,
    });
  });
});

function createService() {
  const repository = new InMemoryContentAiRepository();
  const service = new ContentMgmtService({
    repository,
    now: () => new Date('2026-06-02T08:00:00Z'),
  });
  return { repository, service };
}

function draft(overrides: Partial<ContentDraft>): ContentDraft {
  return {
    id: 'draft-id',
    taskId: 'task-id',
    platform: Platform.XIAOHONGSHU,
    status: ContentStatus.DRAFT,
    title: '气虚质厨房调理',
    body: '非医疗诊断。先从早餐和睡眠节律调整。',
    tags: ['气虚质'],
    versions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

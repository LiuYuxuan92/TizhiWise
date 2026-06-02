import { describe, expect, it } from 'vitest';
import { AgentRole, ContentStatus, Platform, TaskStatus } from '@tizhice/shared';
import { defaultAgentWorkflow } from './content-ai.fixtures';
import { ContentAIService } from './content-ai.service';
import { InMemoryContentAiRepository } from './in-memory-content-ai.repository';
import { DeterministicLlmProvider } from './llm-provider';

describe('ContentAIService', () => {
  it('publishes workflow config and creates traceable multi-platform drafts', async () => {
    const { service } = createService();
    await service.bootstrapDefaults();

    const created = await service.createTask({
      operatorId: 'op-1',
      platforms: [Platform.XIAOHONGSHU, Platform.VIDEO_CHANNEL, Platform.MOMENTS],
      topic: '气虚质调理',
    });
    const task = await service.getTaskStatus(created.taskId);

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.outputs.map((output) => output.platform).sort()).toEqual(
      [Platform.MOMENTS, Platform.VIDEO_CHANNEL, Platform.XIAOHONGSHU].sort(),
    );
    expect(task.workflowVersion).toBe('v1');
    expect(task.modelVersions[AgentRole.COPYWRITER]).toBe('mock-copy-v1');
    expect(task.promptVersions[AgentRole.COPYWRITER]).toBe('v1:COPYWRITER');
    const draft = await service.getDraft(task.outputs[0]!.draftId);
    expect(draft.status).toBe(ContentStatus.DRAFT);
    expect(draft.body).toContain('非医疗诊断');
  });

  it('rewrites risky copy before saving draft and never approves non-compliant text', async () => {
    const { service } = createService();
    await service.bootstrapDefaults();
    const created = await service.createTask({
      operatorId: 'op-risk',
      platforms: [Platform.XIAOHONGSHU],
      topic: '颈椎痛治疗最好方案',
      additionalContext: '必须根治，100% 有效',
    });
    const task = await service.getTaskStatus(created.taskId);
    const draft = await service.getDraft(task.outputs[0]!.draftId);

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(draft.body).not.toContain('治疗');
    expect(draft.body).not.toContain('根治');
    expect(draft.body).not.toContain('100% 有效');
    expect(draft.status).toBe(ContentStatus.DRAFT);
  });

  it('isolates platform failures and marks task as partial failed when other platforms succeed', async () => {
    const { service, llm } = createService();
    await service.bootstrapDefaults();
    llm.failTimes(AgentRole.COPYWRITER, Platform.VIDEO_CHANNEL, 99);

    const created = await service.createTask({
      operatorId: 'op-fail',
      platforms: [Platform.XIAOHONGSHU, Platform.VIDEO_CHANNEL],
      topic: '湿热质调理',
    });
    const task = await service.getTaskStatus(created.taskId);

    expect(task.status).toBe(TaskStatus.PARTIAL_FAILED);
    expect(task.outputs).toHaveLength(1);
    expect(task.outputs[0]?.platform).toBe(Platform.XIAOHONGSHU);
    expect(task.failureReason).toBe('model_error');
  });

  it('supports explicit workflow publication and retrieval', async () => {
    const { service } = createService();
    const workflow = defaultAgentWorkflow('ignored');
    const published = await service.publishWorkflow({
      ...workflow,
      publishedAt: new Date(),
    });

    await expect(service.getWorkflow(published.version)).resolves.toMatchObject({
      version: published.version,
      agents: expect.arrayContaining([expect.objectContaining({ role: AgentRole.COPYWRITER })]),
    });
  });
});

function createService() {
  const repository = new InMemoryContentAiRepository();
  const llm = new DeterministicLlmProvider();
  const service = new ContentAIService({ repository, llm });
  return { service, repository, llm };
}

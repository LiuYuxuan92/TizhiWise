import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AgentRole, Platform, TaskStatus } from '@tizhice/shared';
import { ContentAIService } from './content-ai.service';
import { InMemoryContentAiRepository } from './in-memory-content-ai.repository';
import { DeterministicLlmProvider } from './llm-provider';

describe('ContentAIService properties', () => {
  it('Property 22: compliance gate prevents risky drafts from being approved as clean', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('治疗', '治愈', '根治', '100% 有效', '必须'),
        async (risk) => {
          const { service } = createService();
          await service.bootstrapDefaults();
          const created = await service.createTask({
            operatorId: 'p22',
            platforms: [Platform.XIAOHONGSHU],
            topic: `体质${risk}建议`,
            additionalContext: risk,
          });
          const task = await service.getTaskStatus(created.taskId);
          const draft = await service.getDraft(task.outputs[0]!.draftId);

          expect(draft.body).not.toContain(risk);
          expect(draft.body).toContain('非医疗诊断');
        },
      ),
      { numRuns: 12 },
    );
  });

  it('Property 23: one platform failure does not prevent other platform outputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(Platform.XIAOHONGSHU, Platform.VIDEO_CHANNEL),
        async (failed) => {
          const { service, llm } = createService();
          await service.bootstrapDefaults();
          llm.failTimes(AgentRole.COPYWRITER, failed, 99);
          const platforms = [Platform.XIAOHONGSHU, Platform.VIDEO_CHANNEL, Platform.MOMENTS];

          const created = await service.createTask({
            operatorId: 'p23',
            platforms,
            topic: '气郁质调理',
          });
          const task = await service.getTaskStatus(created.taskId);

          expect(task.status).toBe(TaskStatus.PARTIAL_FAILED);
          expect(task.outputs.map((output) => output.platform)).not.toContain(failed);
          expect(task.outputs.length).toBe(platforms.length - 1);
        },
      ),
      { numRuns: 8 },
    );
  });

  it('Property 24: successful tasks produce one independent draft per requested platform', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.constantFrom(...Object.values(Platform)), { minLength: 1, maxLength: 3 }),
        async (platforms) => {
          const { service } = createService();
          await service.bootstrapDefaults();
          const created = await service.createTask({
            operatorId: 'p24',
            platforms,
            topic: '痰湿质调理',
          });
          const task = await service.getTaskStatus(created.taskId);

          expect(task.status).toBe(TaskStatus.COMPLETED);
          expect(task.outputs.map((output) => output.platform).sort()).toEqual(
            [...platforms].sort(),
          );
          expect(new Set(task.outputs.map((output) => output.draftId)).size).toBe(platforms.length);
        },
      ),
      { numRuns: 12 },
    );
  });

  it('Property 25: task records workflow, model and prompt versions', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...Object.values(Platform)), async (platform) => {
        const { service } = createService();
        await service.bootstrapDefaults();
        const created = await service.createTask({
          operatorId: 'p25',
          platforms: [platform],
          topic: '阳虚质调理',
        });
        const task = await service.getTaskStatus(created.taskId);

        expect(task.workflowVersion).toBe('v1');
        for (const role of Object.values(AgentRole)) {
          expect(task.modelVersions[role]).toBeTruthy();
          expect(task.promptVersions[role]).toContain(role);
        }
      }),
      { numRuns: 8 },
    );
  });

  it('Property 26: provider retries are capped by agent maxRetries', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 3, max: 10 }), async (failTimes) => {
        const { service, llm } = createService();
        await service.bootstrapDefaults();
        llm.failTimes(AgentRole.COPYWRITER, Platform.MOMENTS, failTimes);

        const created = await service.createTask({
          operatorId: 'p26',
          platforms: [Platform.MOMENTS],
          topic: '阴虚质调理',
        });
        const task = await service.getTaskStatus(created.taskId);

        expect(task.status).toBe(TaskStatus.FAILED);
        expect(task.failureReason).toBe('model_error');
        expect(task.outputs).toHaveLength(0);
      }),
      { numRuns: 8 },
    );
  });
});

function createService() {
  const repository = new InMemoryContentAiRepository();
  const llm = new DeterministicLlmProvider();
  const service = new ContentAIService({ repository, llm });
  return { service, repository, llm };
}

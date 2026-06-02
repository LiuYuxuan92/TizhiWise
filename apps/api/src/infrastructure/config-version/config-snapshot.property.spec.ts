import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ConfigKind } from '@tizhice/shared';
import { ConfigVersionService } from './config-version.service';
import { InMemoryConfigVersionRepository } from './in-memory-config-version.repository';

describe('ConfigVersionService Property 19', () => {
  it('session snapshot versions stay equal to creation-time active versions regardless of later active changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            ConfigKind.QUESTION_BANK,
            ConfigKind.ALGORITHM,
            ConfigKind.REPORT_TEMPLATE,
            ConfigKind.AGENT_WORKFLOW,
          ),
          {
            minLength: 1,
            maxLength: 4,
          },
        ),
        fc.integer({ min: 1, max: 5 }),
        async (rawKinds, publishCount) => {
          const kinds = [...new Set(rawKinds)];
          const service = new ConfigVersionService(new InMemoryConfigVersionRepository());
          for (const kind of kinds) {
            await service.publish(kind, { generation: 1, kind }, 'admin');
          }

          const snapshot = await service.snapshotForSession('session-p19', kinds);

          for (let generation = 2; generation <= publishCount + 1; generation += 1) {
            for (const kind of kinds) {
              await service.publish(kind, { generation, kind }, 'admin');
            }
          }

          await expect(service.snapshotForSession('session-p19', kinds)).resolves.toEqual(snapshot);
          for (const kind of kinds) {
            expect(snapshot[kind]).toBe('v1');
            await expect(service.getActive(kind)).resolves.toMatchObject({
              version: `v${publishCount + 1}`,
            });
          }
        },
      ),
    );
  });
});

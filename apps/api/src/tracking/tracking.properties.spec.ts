import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ConsentScope, EventType } from '@tizhice/shared';
import { createTrackingFixture } from './tracking-test-fixtures';

describe('TrackingService properties', () => {
  it('Property 28: after revoking behavior tracking, new track calls are discarded', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (attemptsAfterRevoke) => {
        const { trackingService, trackingRepository, userService, createUserWithTracking } =
          await createTrackingFixture();
        const userId = await createUserWithTracking('p28');
        await userService.updateConsent(userId, [ConsentScope.BASIC, ConsentScope.HEALTH_DATA]);

        for (let index = 0; index < attemptsAfterRevoke; index += 1) {
          await trackingService.track({
            userId,
            type: EventType.COMPLETE_ASSESSMENT,
            occurredAt: new Date(),
          });
        }

        expect(await trackingRepository.listEvents()).toHaveLength(0);
      }),
      { numRuns: 12 },
    );
  });

  it('Property 30: aggregate cells below minimum sample size are suppressed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 4 }),
        async (threshold, smallCount) => {
          const { trackingService, createUserWithTracking } = await createTrackingFixture({
            minAggregateCellSize: threshold,
          });
          const userId = await createUserWithTracking('p30');
          const now = new Date();
          for (let index = 0; index < smallCount; index += 1) {
            await trackingService.track({
              userId,
              type: EventType.COMPLETE_ASSESSMENT,
              channelSource: 'small-cell',
              occurredAt: now,
            });
          }

          const exported = await trackingService.exportAggregate({
            dateRange: [new Date(now.getTime() - 1_000), new Date(now.getTime() + 1_000)],
            groupBy: 'SOURCE',
          });
          const file = await trackingService.getExport(exported.fileUrl);
          const row = file?.rows.find((candidate) => candidate.key === 'small-cell');

          expect(row?.count).toBe(smallCount < threshold ? 'SUPPRESSED' : smallCount);
        },
      ),
      { numRuns: 12 },
    );
  });
});

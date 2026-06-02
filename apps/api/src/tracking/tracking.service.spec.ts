import { describe, expect, it } from 'vitest';
import { AssessmentChannel, ConsentScope, ConstitutionType, EventType } from '@tizhice/shared';
import { createTrackingFixture } from './tracking-test-fixtures';

describe('TrackingService', () => {
  it('tracks behavior events only when logged-in user granted behavior tracking consent', async () => {
    const { trackingService, trackingRepository, userService, createUserWithTracking } =
      await createTrackingFixture();
    const allowedUser = await createUserWithTracking('allowed');
    const denied = await userService.wechatLogin('denied');

    await trackingService.track({
      userId: allowedUser,
      type: EventType.ENTER_ASSESSMENT,
      channel: AssessmentChannel.CONSTITUTION,
      channelSource: 'xiaohongshu',
      occurredAt: new Date(),
    });
    await trackingService.track({
      userId: denied.userId,
      type: EventType.ENTER_ASSESSMENT,
      channel: AssessmentChannel.CONSTITUTION,
      channelSource: 'video',
      occurredAt: new Date(),
    });

    const events = await trackingRepository.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ userId: allowedUser, channelSource: 'xiaohongshu' });
  });

  it('builds constitution trend points from repeated assessment results', async () => {
    const { trackingService, createUserWithTracking, finalizeConstitution } =
      await createTrackingFixture();
    const userId = await createUserWithTracking('trend');
    await finalizeConstitution(userId);
    await finalizeConstitution(userId);

    const trend = await trackingService.getTrend(userId, AssessmentChannel.CONSTITUTION);

    expect(trend.userId).toBe(userId);
    expect(trend.points).toHaveLength(2);
    expect(trend.points.every((point) => point.primary === ConstitutionType.QIXU)).toBe(true);
  });

  it('aggregates dashboard metrics by time range and channel source', async () => {
    const { trackingService, createUserWithTracking } = await createTrackingFixture();
    const userId = await createUserWithTracking('dashboard');
    const now = new Date();

    await trackingService.track({
      userId,
      type: EventType.COMPLETE_ASSESSMENT,
      channel: AssessmentChannel.CONSTITUTION,
      channelSource: 'source-a',
      metadata: { primary: ConstitutionType.QIXU },
      occurredAt: now,
    });
    await trackingService.track({
      userId,
      type: EventType.INITIATE_PAYMENT,
      channelSource: 'source-a',
      occurredAt: now,
    });
    await trackingService.track({
      userId,
      type: EventType.PAYMENT_SUCCESS,
      channelSource: 'source-a',
      occurredAt: now,
    });

    const dashboard = await trackingService.getDashboard({
      dateRange: [new Date(now.getTime() - 1_000), new Date(now.getTime() + 1_000)],
      channelSource: 'source-a',
    });

    expect(dashboard.completedCount).toBe(1);
    expect(dashboard.paidConversionRate).toBe(1);
    expect(dashboard.constitutionDistribution).toMatchObject({ QIXU: 1 });
    expect(dashboard.sourceBreakdown).toMatchObject({ 'source-a': 3 });
  });

  it('exports aggregate rows with small cells suppressed', async () => {
    const { trackingService, createUserWithTracking } = await createTrackingFixture({
      minAggregateCellSize: 3,
    });
    const userId = await createUserWithTracking('export');
    const now = new Date();
    for (const source of ['large', 'large', 'large', 'small']) {
      await trackingService.track({
        userId,
        type: EventType.COMPLETE_ASSESSMENT,
        channelSource: source,
        metadata: { primary: ConstitutionType.QIXU, ageBand: '26-35' },
        occurredAt: now,
      });
    }

    const exported = await trackingService.exportAggregate({
      dateRange: [new Date(now.getTime() - 1_000), new Date(now.getTime() + 1_000)],
      groupBy: 'SOURCE',
    });
    const file = await trackingService.getExport(exported.fileUrl);

    expect(file?.rows).toEqual([
      { key: 'large', count: 3 },
      { key: 'small', count: 'SUPPRESSED' },
    ]);
  });

  it('stops collecting after BEHAVIOR_TRACKING consent is revoked', async () => {
    const { trackingService, trackingRepository, userService, createUserWithTracking } =
      await createTrackingFixture();
    const userId = await createUserWithTracking('revoke');
    const now = new Date();

    await trackingService.track({
      userId,
      type: EventType.ENTER_ASSESSMENT,
      occurredAt: now,
    });
    await userService.updateConsent(userId, [ConsentScope.BASIC, ConsentScope.HEALTH_DATA]);
    await trackingService.track({
      userId,
      type: EventType.COMPLETE_ASSESSMENT,
      occurredAt: now,
    });

    expect(await trackingRepository.listEvents()).toHaveLength(1);
  });
});

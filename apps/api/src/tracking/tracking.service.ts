import {
  AssessmentChannel,
  ConsentScope,
  ConstitutionType,
  EventType,
  type AggregateGroupBy,
  type BehaviorEvent,
  type DashboardData,
  type DashboardFilters,
  type ExportAggregateInput,
  type ExportAggregateResult,
  type TrackEventInput,
  type TrendSeries,
} from '@tizhice/shared';
import type { InMemoryAssessmentRepository } from '../assessment/in-memory-assessment.repository';
import type { InMemoryPaymentRepository } from '../payment/in-memory-payment.repository';
import type { InMemoryUserRepository } from '../user/in-memory-user.repository';
import type {
  ExportedAggregateFile,
  InMemoryTrackingRepository,
} from './in-memory-tracking.repository';

interface TrackingServiceDependencies {
  repository: InMemoryTrackingRepository;
  users: InMemoryUserRepository;
  assessmentRepository: InMemoryAssessmentRepository;
  paymentRepository: InMemoryPaymentRepository;
  minAggregateCellSize?: number;
}

export class TrackingService {
  private readonly minAggregateCellSize: number;

  constructor(private readonly dependencies: TrackingServiceDependencies) {
    this.minAggregateCellSize = dependencies.minAggregateCellSize ?? 5;
  }

  async track(input: TrackEventInput): Promise<void> {
    if (input.userId) {
      const user = await this.dependencies.users.getUserOrThrow(input.userId);
      if (!user.consentScopes.includes(ConsentScope.BEHAVIOR_TRACKING)) {
        return;
      }
    }
    const event: BehaviorEvent = {
      ...input,
      id: this.dependencies.repository.nextEventId(),
      metadata: input.metadata ? { ...input.metadata } : undefined,
      occurredAt: new Date(input.occurredAt),
    };
    await this.dependencies.repository.saveEvent(event);
  }

  async getTrend(userId: string, channel: AssessmentChannel): Promise<TrendSeries> {
    if (channel === AssessmentChannel.CONSTITUTION) {
      const results =
        await this.dependencies.assessmentRepository.listConstitutionResultsByUser(userId);
      return {
        userId,
        channel,
        points: results.map((result) => ({
          occurredAt: result.computedAt,
          primary: result.primary,
          metadata: {
            resultId: result.resultId,
            isPinghe: result.isPinghe,
          },
        })),
      };
    }

    const painResults = await this.dependencies.assessmentRepository.listPainResultsByUser(userId);
    return {
      userId,
      channel,
      points: painResults.map((result) => ({
        occurredAt: new Date(0),
        painSeverity: result.severity ?? undefined,
        metadata: {
          resultId: result.resultId,
          redFlagLevel: result.redFlagLevel,
        },
      })),
    };
  }

  async getDashboard(filters: DashboardFilters): Promise<DashboardData> {
    const events = await this.dependencies.repository.listEvents(filters);
    const completed = events.filter((event) => event.type === EventType.COMPLETE_ASSESSMENT);
    const initiatePayment = events.filter((event) => event.type === EventType.INITIATE_PAYMENT);
    const paymentSuccess = events.filter((event) => event.type === EventType.PAYMENT_SUCCESS);
    return {
      completedCount: completed.length,
      paidConversionRate:
        initiatePayment.length === 0 ? 0 : paymentSuccess.length / initiatePayment.length,
      constitutionDistribution: countByConstitution(completed),
      sourceBreakdown: countBySource(events),
    };
  }

  async exportAggregate(input: ExportAggregateInput): Promise<ExportAggregateResult> {
    const events = await this.dependencies.repository.listEvents({
      dateRange: input.dateRange,
    });
    const rows = suppressSmallCells(groupEvents(events, input.groupBy), this.minAggregateCellSize);
    return this.dependencies.repository.saveExport(input.groupBy, rows);
  }

  async getExport(fileUrl: string): Promise<ExportedAggregateFile | undefined> {
    return this.dependencies.repository.getExport(fileUrl);
  }
}

function countByConstitution(
  events: readonly BehaviorEvent[],
): Partial<Record<ConstitutionType, number>> {
  const counts: Partial<Record<ConstitutionType, number>> = {};
  for (const event of events) {
    const primary = event.metadata?.primary;
    if (isConstitutionType(primary)) {
      counts[primary] = (counts[primary] ?? 0) + 1;
    }
  }
  return counts;
}

function countBySource(events: readonly BehaviorEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const source = event.channelSource ?? 'DIRECT';
    counts[source] = (counts[source] ?? 0) + 1;
  }
  return counts;
}

function groupEvents(
  events: readonly BehaviorEvent[],
  groupBy: AggregateGroupBy,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = groupKey(event, groupBy);
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function groupKey(event: BehaviorEvent, groupBy: AggregateGroupBy): string | undefined {
  switch (groupBy) {
    case 'CONSTITUTION':
      return typeof event.metadata?.primary === 'string' ? event.metadata.primary : undefined;
    case 'AGE_BAND':
      return typeof event.metadata?.ageBand === 'string' ? event.metadata.ageBand : undefined;
    case 'SOURCE':
      return event.channelSource ?? 'DIRECT';
    default:
      groupBy satisfies never;
      return undefined;
  }
}

function suppressSmallCells(
  counts: ReadonlyMap<string, number>,
  threshold: number,
): Array<{ key: string; count: number | 'SUPPRESSED' }> {
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({
      key,
      count: count < threshold ? 'SUPPRESSED' : count,
    }));
}

function isConstitutionType(value: unknown): value is ConstitutionType {
  return (
    typeof value === 'string' && Object.values(ConstitutionType).includes(value as ConstitutionType)
  );
}

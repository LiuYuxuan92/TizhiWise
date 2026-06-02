import type {
  AggregateGroupBy,
  BehaviorEvent,
  DashboardFilters,
  ExportAggregateResult,
} from '@tizhice/shared';

export interface ExportedAggregateFile extends ExportAggregateResult {
  rows: Array<{ key: string; count: number | 'SUPPRESSED' }>;
  groupBy: AggregateGroupBy;
  generatedAt: Date;
}

export class InMemoryTrackingRepository {
  private eventCounter = 0;
  private exportCounter = 0;
  private readonly events: BehaviorEvent[] = [];
  private readonly exports = new Map<string, ExportedAggregateFile>();

  nextEventId(): string {
    this.eventCounter += 1;
    return `behavior-event-${this.eventCounter}`;
  }

  async saveEvent(event: BehaviorEvent): Promise<void> {
    this.events.push(cloneEvent(event));
  }

  async listEvents(filters?: DashboardFilters): Promise<BehaviorEvent[]> {
    return this.events
      .filter((event) => {
        if (!filters) {
          return true;
        }
        const [from, to] = filters.dateRange;
        const inRange =
          event.occurredAt.getTime() >= from.getTime() &&
          event.occurredAt.getTime() <= to.getTime();
        const sourceMatches =
          !filters.channelSource || event.channelSource === filters.channelSource;
        return inRange && sourceMatches;
      })
      .map(cloneEvent);
  }

  async saveExport(
    groupBy: AggregateGroupBy,
    rows: Array<{ key: string; count: number | 'SUPPRESSED' }>,
  ): Promise<ExportedAggregateFile> {
    this.exportCounter += 1;
    const file: ExportedAggregateFile = {
      fileUrl: `memory://aggregate-export-${this.exportCounter}.json`,
      rows: rows.map((row) => ({ ...row })),
      groupBy,
      generatedAt: new Date(),
    };
    this.exports.set(file.fileUrl, cloneExport(file));
    return cloneExport(file);
  }

  async getExport(fileUrl: string): Promise<ExportedAggregateFile | undefined> {
    const file = this.exports.get(fileUrl);
    return file ? cloneExport(file) : undefined;
  }
}

function cloneEvent(event: BehaviorEvent): BehaviorEvent {
  return {
    ...event,
    metadata: event.metadata ? { ...event.metadata } : undefined,
    occurredAt: new Date(event.occurredAt),
  };
}

function cloneExport(file: ExportedAggregateFile): ExportedAggregateFile {
  return {
    ...file,
    rows: file.rows.map((row) => ({ ...row })),
    generatedAt: new Date(file.generatedAt),
  };
}

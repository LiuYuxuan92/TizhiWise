import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { AggregateExportEntity, BehaviorEventEntity } from './tracking.entities';

describe('tracking entities', () => {
  it('map behavior events and aggregate export tables', () => {
    expect(tableName(BehaviorEventEntity)).toBe('behavior_events');
    expect(tableName(AggregateExportEntity)).toBe('aggregate_exports');
    expect(columnNames(BehaviorEventEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'anonymousId',
        'type',
        'channel',
        'channelSource',
        'metadata',
        'occurredAt',
      ]),
    );
    expect(columnNames(AggregateExportEntity)).toEqual(
      expect.arrayContaining(['fileUrl', 'groupBy', 'rowsJson', 'generatedAt']),
    );
  });
});

type EntityConstructor = new (...args: never[]) => unknown;

function tableName(target: EntityConstructor): string | undefined {
  return getMetadataArgsStorage().tables.find((candidate) => candidate.target === target)?.name;
}

function columnNames(target: EntityConstructor): string[] {
  return getMetadataArgsStorage()
    .columns.filter((candidate) => candidate.target === target)
    .map((column) => column.propertyName);
}

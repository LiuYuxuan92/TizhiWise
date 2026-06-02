import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import {
  ReportDeepAccessEntity,
  ReportEntity,
  ReportExportJobEntity,
  ReportShareLinkEntity,
} from './report.entities';

describe('report entities', () => {
  it('map report, access, sharing and export tables with encrypted payload column', () => {
    expect(tableName(ReportEntity)).toBe('reports');
    expect(tableName(ReportDeepAccessEntity)).toBe('report_deep_access');
    expect(tableName(ReportShareLinkEntity)).toBe('report_share_links');
    expect(tableName(ReportExportJobEntity)).toBe('report_export_jobs');

    expect(columnNames(ReportEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'sessionId',
        'type',
        'tier',
        'templateVersion',
        'payloadCiphertext',
        'createdAt',
      ]),
    );
    expect(columnNames(ReportDeepAccessEntity)).toEqual(
      expect.arrayContaining(['reportId', 'userId', 'orderId', 'grantedAt', 'revokedAt']),
    );
    expect(
      getMetadataArgsStorage().indices.some(
        (index) =>
          index.target === ReportDeepAccessEntity &&
          index.unique === true &&
          index.where === 'revoked_at IS NULL',
      ),
    ).toBe(true);
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

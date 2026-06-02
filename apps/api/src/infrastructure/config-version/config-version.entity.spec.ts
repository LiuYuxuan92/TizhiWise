import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { ConfigKind } from '@tizhice/shared';
import { ConfigVersionEntity } from './config-version.entity';

describe('ConfigVersionEntity', () => {
  it('maps to the required config_versions table and columns', () => {
    const table = getMetadataArgsStorage().tables.find(
      (candidate) => candidate.target === ConfigVersionEntity,
    );
    const columns = getMetadataArgsStorage()
      .columns.filter((candidate) => candidate.target === ConfigVersionEntity)
      .map((column) => column.propertyName);
    const indexes = getMetadataArgsStorage().indices.filter(
      (candidate) => candidate.target === ConfigVersionEntity,
    );

    expect(table?.name).toBe('config_versions');
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'kind',
        'version',
        'payloadJson',
        'publishedBy',
        'publishedAt',
        'active',
        'immutable',
      ]),
    );
    expect(new ConfigVersionEntity()).toMatchObject({ immutable: true, active: true });
    expect(
      indexes.some((index) => {
        const indexColumns = Array.isArray(index.columns) ? index.columns : [];
        return (
          indexColumns.length === 2 &&
          indexColumns.includes('kind') &&
          indexColumns.includes('active') &&
          index.unique === true &&
          index.where === 'active = true'
        );
      }),
    ).toBe(true);
    expect(Object.values(ConfigKind)).toContain(ConfigKind.ALGORITHM);
  });
});

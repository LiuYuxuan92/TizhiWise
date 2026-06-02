import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { ConsentEntity, UserEntity } from './user.entities';

describe('user entities', () => {
  it('map encrypted WeChat identifiers and consent history tables', () => {
    expect(tableName(UserEntity)).toBe('users');
    expect(tableName(ConsentEntity)).toBe('consents');
    expect(columnNames(UserEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'wxOpenIdCiphertext',
        'wxUnionIdCiphertext',
        'nickname',
        'consentScopes',
        'deletedAt',
      ]),
    );
    expect(columnNames(ConsentEntity)).toEqual(
      expect.arrayContaining(['userId', 'scope', 'grantedAt', 'revokedAt']),
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

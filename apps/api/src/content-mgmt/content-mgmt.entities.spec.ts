import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { ContentDraftEntity, ContentVersionEntity } from './content-mgmt.entities';

describe('content management entities', () => {
  it('map content draft and version-history tables', () => {
    expect(tableName(ContentDraftEntity)).toBe('content_drafts');
    expect(tableName(ContentVersionEntity)).toBe('content_versions');

    expect(columnNames(ContentDraftEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'taskId',
        'platform',
        'status',
        'title',
        'body',
        'scriptJson',
        'tags',
        'complianceFlags',
        'createdAt',
        'publishedAt',
        'publishedBy',
        'publishedPlatform',
      ]),
    );
    expect(columnNames(ContentVersionEntity)).toEqual(
      expect.arrayContaining(['id', 'draftId', 'editedBy', 'editedAt', 'diff']),
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

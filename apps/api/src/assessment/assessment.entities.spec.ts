import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import {
  AnswerEntity,
  AssessmentSessionEntity,
  ConstitutionResultEntity,
  PainResultEntity,
} from './assessment.entities';

describe('assessment entities', () => {
  it('map required assessment tables and encrypted sensitive columns', () => {
    expect(tableName(AssessmentSessionEntity)).toBe('assessment_sessions');
    expect(tableName(AnswerEntity)).toBe('answers');
    expect(tableName(ConstitutionResultEntity)).toBe('constitution_results');
    expect(tableName(PainResultEntity)).toBe('pain_results');

    expect(columnNames(AssessmentSessionEntity)).toEqual(
      expect.arrayContaining([
        'baseProfileCiphertext',
        'questionBankVersion',
        'algorithmVersion',
        'status',
      ]),
    );
    expect(columnNames(AnswerEntity)).toEqual(
      expect.arrayContaining(['valueCiphertext', 'sessionId', 'questionId']),
    );
    expect(columnNames(ConstitutionResultEntity)).toEqual(
      expect.arrayContaining(['scoresJson', 'primaryType', 'concurrentTypes', 'algorithmVersion']),
    );
    expect(columnNames(PainResultEntity)).toEqual(
      expect.arrayContaining(['areasJson', 'severity', 'redFlagLevel']),
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

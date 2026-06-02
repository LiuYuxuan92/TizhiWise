import {
  CONSTITUTION_TYPES,
  type AlgorithmConfig,
  type AnswerScore,
  type ConstitutionType,
} from '@tizhice/shared';

interface BuildConfigOptions {
  version: string;
  itemsPerType: number;
  biasedYes?: number;
  biasedTendency?: number;
}

export function buildAlgorithmConfig(options: BuildConfigOptions): AlgorithmConfig {
  const questionMapping = CONSTITUTION_TYPES.flatMap((constitution) =>
    Array.from({ length: options.itemsPerType }, (_, index) => ({
      questionId: `${constitution}_${index + 1}`,
      constitution,
      weight: 1,
    })),
  );

  return {
    version: options.version,
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    thresholds: {
      pinghe: { selfMin: 60, biasedMaxExclusive: 30 },
      biased: { yes: options.biasedYes ?? 40, tendency: options.biasedTendency ?? 30 },
    },
    questionMapping,
  };
}

export function buildAnswersForScores(
  config: AlgorithmConfig,
  overrides: Partial<Record<ConstitutionType, readonly number[]>>,
): AnswerScore[] {
  const perTypeIndex = new Map<ConstitutionType, number>();
  return config.questionMapping.map((mapping) => {
    const index = perTypeIndex.get(mapping.constitution) ?? 0;
    perTypeIndex.set(mapping.constitution, index + 1);
    return {
      questionId: mapping.questionId,
      score: overrides[mapping.constitution]?.[index] ?? 1,
    };
  });
}

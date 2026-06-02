import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  BIASED_CONSTITUTION_TYPES,
  CONSTITUTION_TYPES,
  ConstitutionJudgment,
  ConstitutionType,
  type AlgorithmConfig,
  type AnswerScore,
} from '@tizhice/shared';
import { ConstitutionAlgoService } from './constitution-algo.service';
import { InMemoryAlgorithmConfigRepository } from './in-memory-algorithm-config.repository';
import { buildAlgorithmConfig, buildAnswersForScores } from './constitution-test-fixtures';

describe('ConstitutionAlgoService', () => {
  it('computes converted scores using the standard formula and sorts concurrent constitutions', async () => {
    const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
    const service = new ConstitutionAlgoService(new InMemoryAlgorithmConfigRepository([config]));
    const answers = buildAnswersForScores(config, {
      PINGHE: [3, 3],
      QIXU: [5, 5],
      YANGXU: [4, 4],
      YINXU: [2, 2],
      TANSHI: [1, 1],
      SHIRE: [1, 1],
      XUEYU: [1, 1],
      QIYU: [1, 1],
      TEBING: [1, 1],
    });

    const result = await service.judge({ answers, algorithmVersion: 'v1', sessionId: 'session-1' });

    expect(scoreOf(result, ConstitutionType.QIXU)).toMatchObject({
      rawScore: 10,
      itemCount: 2,
      convertedScore: 100,
      judgment: ConstitutionJudgment.YES,
    });
    expect(scoreOf(result, ConstitutionType.YANGXU)).toMatchObject({
      rawScore: 8,
      itemCount: 2,
      convertedScore: 75,
      judgment: ConstitutionJudgment.YES,
    });
    expect(result.primary).toBe(ConstitutionType.QIXU);
    expect(result.concurrent[0]).toBe(ConstitutionType.YANGXU);
  });

  it('applies the pinghe mutual-exclusion rule before biased primary selection', async () => {
    const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
    const service = new ConstitutionAlgoService(new InMemoryAlgorithmConfigRepository([config]));
    const answers = buildAnswersForScores(config, {
      PINGHE: [5, 5],
      QIXU: [2, 2],
      YANGXU: [1, 1],
      YINXU: [1, 1],
      TANSHI: [1, 1],
      SHIRE: [1, 1],
      XUEYU: [1, 1],
      QIYU: [1, 1],
      TEBING: [1, 1],
    });

    const result = await service.judge({ answers, algorithmVersion: 'v1', sessionId: 'session-2' });

    expect(result.isPinghe).toBe(true);
    expect(result.primary).toBe(ConstitutionType.PINGHE);
    expect(result.concurrent).toEqual([]);
  });

  it('uses the requested algorithm version rather than the latest published version', async () => {
    const oldConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 1, biasedYes: 40 });
    const repository = new InMemoryAlgorithmConfigRepository([oldConfig]);
    const service = new ConstitutionAlgoService(repository);
    const answers = buildAnswersForScores(oldConfig, { QIXU: [3] });
    const oldResult = await service.judge({
      answers,
      algorithmVersion: 'v1',
      sessionId: 'session-3',
    });

    await service.publishConfig({
      ...buildAlgorithmConfig({ version: 'draft', itemsPerType: 1, biasedYes: 80 }),
      version: '',
    });
    const recomputed = await service.judge({
      answers,
      algorithmVersion: 'v1',
      sessionId: 'session-3',
    });

    expect(recomputed.scores).toEqual(oldResult.scores);
    expect(recomputed.primary).toBe(oldResult.primary);
  });

  it('Property 1: converted scores are always bounded in [0, 100]', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const result = await service.judge({
          answers: matrixToAnswers(config, answerMatrix),
          algorithmVersion: 'v1',
          sessionId: 'p1',
        });

        expect(
          result.scores.every((score) => score.convertedScore >= 0 && score.convertedScore <= 100),
        ).toBe(true);
      }),
    );
  });

  it('Property 3: converted score formula is correct when weight is 1', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const result = await service.judge({
          answers: matrixToAnswers(config, answerMatrix),
          algorithmVersion: 'v1',
          sessionId: 'p3',
        });

        for (const score of result.scores) {
          expect(score.convertedScore).toBeCloseTo(
            ((score.rawScore - score.itemCount) / (score.itemCount * 4)) * 100,
            10,
          );
        }
      }),
    );
  });

  it('Property 9: increasing a related answer never decreases that constitution converted score', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom(...CONSTITUTION_TYPES),
        async (baseScore, type) => {
          const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
          const service = new ConstitutionAlgoService(
            new InMemoryAlgorithmConfigRepository([config]),
          );
          const baseline = buildAnswersForScores(config, { [type]: [baseScore, baseScore] });
          const improved = buildAnswersForScores(config, { [type]: [baseScore + 1, baseScore] });

          const before = await service.judge({
            answers: baseline,
            algorithmVersion: 'v1',
            sessionId: 'before',
          });
          const after = await service.judge({
            answers: improved,
            algorithmVersion: 'v1',
            sessionId: 'after',
          });

          expect(scoreOf(after, type).convertedScore).toBeGreaterThanOrEqual(
            scoreOf(before, type).convertedScore,
          );
        },
      ),
    );
  });

  it('Property 4: pinghe is true iff pinghe>=60 and all biased constitutions are <30', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const result = await service.judge({
          answers: matrixToAnswers(config, answerMatrix),
          algorithmVersion: 'v1',
          sessionId: 'p4',
        });
        const pinghe = scoreOf(result, ConstitutionType.PINGHE).convertedScore;
        const biasedAreLow = BIASED_CONSTITUTION_TYPES.every(
          (type) => scoreOf(result, type).convertedScore < 30,
        );

        expect(result.isPinghe).toBe(pinghe >= 60 && biasedAreLow);
      }),
    );
  });

  it('Property 5: biased thresholds map to YES/TENDENCY/NO', async () => {
    const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 10 });
    const service = new ConstitutionAlgoService(new InMemoryAlgorithmConfigRepository([config]));
    const result = await service.judge({
      answers: buildAnswersForScores(config, {
        QIXU: Array(10).fill(3),
        YANGXU: [3, 3, 3, 3, 2, 2, 2, 2, 2, 2],
        YINXU: Array(10).fill(2),
      }),
      algorithmVersion: 'v1',
      sessionId: 'p5',
    });

    expect(scoreOf(result, ConstitutionType.QIXU).convertedScore).toBe(50);
    expect(scoreOf(result, ConstitutionType.QIXU).judgment).toBe(ConstitutionJudgment.YES);
    expect(scoreOf(result, ConstitutionType.YANGXU).convertedScore).toBe(35);
    expect(scoreOf(result, ConstitutionType.YANGXU).judgment).toBe(ConstitutionJudgment.TENDENCY);
    expect(scoreOf(result, ConstitutionType.YINXU).convertedScore).toBe(25);
    expect(scoreOf(result, ConstitutionType.YINXU).judgment).toBe(ConstitutionJudgment.NO);
  });

  it('Property 6: concurrent list is sorted by converted score descending', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const result = await service.judge({
          answers: matrixToAnswers(config, answerMatrix),
          algorithmVersion: 'v1',
          sessionId: 'p6',
        });
        const concurrentScores = result.concurrent.map(
          (type) => scoreOf(result, type).convertedScore,
        );
        expect(concurrentScores).toEqual([...concurrentScores].sort((a, b) => b - a));
      }),
    );
  });

  it('Property 7: primary converted score is >= any concurrent score when not pinghe', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const result = await service.judge({
          answers: matrixToAnswers(config, answerMatrix),
          algorithmVersion: 'v1',
          sessionId: 'p7',
        });

        if (!result.isPinghe) {
          const primaryScore = scoreOf(result, result.primary).convertedScore;
          expect(
            result.concurrent.every((type) => primaryScore >= scoreOf(result, type).convertedScore),
          ).toBe(true);
        }
      }),
    );
  });

  it('Property 2: same input and same version produce identical stable results', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const config = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3 });
        const service = new ConstitutionAlgoService(
          new InMemoryAlgorithmConfigRepository([config]),
        );
        const answers = matrixToAnswers(config, answerMatrix);

        const first = await service.judge({
          answers,
          algorithmVersion: 'v1',
          sessionId: 'same-session',
        });
        const second = await service.judge({
          answers,
          algorithmVersion: 'v1',
          sessionId: 'same-session',
        });

        expect({ ...second, resultId: first.resultId, computedAt: first.computedAt }).toEqual(
          first,
        );
      }),
    );
  });
});

function scoreOf(
  result: {
    scores: Array<{
      type: ConstitutionType;
      convertedScore: number;
      rawScore?: number;
      itemCount?: number;
      judgment?: unknown;
    }>;
  },
  type: ConstitutionType,
) {
  const score = result.scores.find((candidate) => candidate.type === type);
  if (!score) {
    throw new Error(`Missing score for ${type}`);
  }
  return score;
}

function answersArbitrary() {
  return fc.array(fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 3, maxLength: 3 }), {
    minLength: CONSTITUTION_TYPES.length,
    maxLength: CONSTITUTION_TYPES.length,
  });
}

function matrixToAnswers(config: AlgorithmConfig, answerMatrix: number[][]): AnswerScore[] {
  const overrides: Partial<Record<ConstitutionType, number[]>> = {};
  CONSTITUTION_TYPES.forEach((type, index) => {
    overrides[type] = answerMatrix[index] ?? [1, 1, 1];
  });
  return buildAnswersForScores(config, overrides);
}

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CONSTITUTION_TYPES,
  type AlgorithmConfig,
  type AnswerScore,
  type ConstitutionType,
} from '@tizhice/shared';
import { ConstitutionAlgoService } from './constitution-algo.service';
import { InMemoryAlgorithmConfigRepository } from './in-memory-algorithm-config.repository';
import { buildAlgorithmConfig, buildAnswersForScores } from './constitution-test-fixtures';

describe('ConstitutionAlgoService Property 8', () => {
  it('historical results remain reproducible with their locked algorithm version after a new version is published', async () => {
    await fc.assert(
      fc.asyncProperty(answersArbitrary(), async (answerMatrix) => {
        const oldConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 3, biasedYes: 40 });
        const repository = new InMemoryAlgorithmConfigRepository([oldConfig]);
        const service = new ConstitutionAlgoService(repository);
        const answers = matrixToAnswers(oldConfig, answerMatrix);
        const historical = await service.judge({
          answers,
          algorithmVersion: 'v1',
          sessionId: 'historic-session',
        });

        await service.publishConfig({
          ...buildAlgorithmConfig({
            version: '',
            itemsPerType: 3,
            biasedYes: 80,
            biasedTendency: 60,
          }),
          version: '',
        });
        const recomputed = await service.judge({
          answers,
          algorithmVersion: 'v1',
          sessionId: 'historic-session',
        });

        expect(recomputed).toEqual(historical);
      }),
    );
  });
});

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

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AssessmentChannel, ConfigKind, Gender, RedFlagLevel } from '@tizhice/shared';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import { buildAlgorithmConfig } from '../constitution/constitution-test-fixtures';
import { InMemoryAlgorithmConfigRepository } from '../constitution/in-memory-algorithm-config.repository';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import { AssessmentService, IncompleteAssessmentError } from './assessment.service';
import { InMemoryAssessmentRepository } from './in-memory-assessment.repository';
import { defaultQuestionBank } from './question-bank.fixtures';

describe('AssessmentService properties', () => {
  it('Property 17: same idempotency key repeated submit does not duplicate answers', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (score) => {
        const { service, repository } = await createService();
        const { sessionId, firstQuestion } = await service.createSession({
          anonymousId: 'p17',
          channel: AssessmentChannel.CONSTITUTION,
          baseProfile: { gender: Gender.M, ageBand: '18-25' },
        });

        const first = await service.submitAnswer({
          sessionId,
          questionId: firstQuestion.id,
          value: score,
          idempotencyKey: 'stable-key',
        });
        const second = await service.submitAnswer({
          sessionId,
          questionId: firstQuestion.id,
          value: score,
          idempotencyKey: 'stable-key',
        });

        expect(second).toEqual(first);
        expect(await repository.countAnswers(sessionId)).toBe(1);
      }),
    );
  });

  it('Property 18: finalize fails with first missing required question while any required answer is absent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (answeredCount) => {
        const { service, algorithmConfig } = await createService();
        const { sessionId } = await service.createSession({
          anonymousId: 'p18',
          channel: AssessmentChannel.CONSTITUTION,
          baseProfile: { gender: Gender.F, ageBand: '26-35' },
        });
        for (const mapping of algorithmConfig.questionMapping.slice(0, answeredCount)) {
          await service.submitAnswer({ sessionId, questionId: mapping.questionId, value: 3 });
        }

        await expect(service.finalize(sessionId)).rejects.toBeInstanceOf(IncompleteAssessmentError);
      }),
    );
  });

  it('Property 20: resume preserves all previously submitted answers exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 4 }),
        async (scores) => {
          const { service, algorithmConfig } = await createService();
          const { sessionId } = await service.createSession({
            anonymousId: 'p20',
            channel: AssessmentChannel.CONSTITUTION,
            baseProfile: { gender: Gender.OTHER, ageBand: '36-45' },
          });
          const expected: Array<{ questionId: string; value: number }> = [];
          for (const [index, score] of scores.entries()) {
            const questionId = algorithmConfig.questionMapping[index]!.questionId;
            expected.push({ questionId, value: score });
            await service.submitAnswer({ sessionId, questionId, value: score });
          }

          const resume = await service.getResume({
            anonymousId: 'p20',
            channel: AssessmentChannel.CONSTITUTION,
          });
          expect(resume?.session.id).toBe(sessionId);
          expect(resume?.answers).toEqual(expected);
        },
      ),
    );
  });

  it('Property 21: red-flag combinations always return warning with non-diagnostic wording', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 8, max: 10 }), async (severity) => {
        const { service } = await createService();
        const { sessionId } = await service.createSession({
          anonymousId: 'p21',
          channel: AssessmentChannel.PAIN,
        });
        await service.submitAnswer({ sessionId, questionId: 'pain_severity', value: severity });
        await service.submitAnswer({ sessionId, questionId: 'pain_duration', value: 'over_72h' });
        const result = await service.submitAnswer({
          sessionId,
          questionId: 'pain_neuro',
          value: ['numbness'],
        });

        expect(result.redFlag?.level).toBe(RedFlagLevel.URGENT);
        expect(result.redFlag?.message).toContain('非诊断');
      }),
    );
  });
});

async function createService() {
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  const algorithmConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
  await configService.publish(
    ConfigKind.QUESTION_BANK,
    defaultQuestionBank(algorithmConfig),
    'seed',
  );
  await configService.publish(ConfigKind.ALGORITHM, algorithmConfig, 'seed');
  const algorithmService = new ConstitutionAlgoService(
    new InMemoryAlgorithmConfigRepository([algorithmConfig]),
  );
  const repository = new InMemoryAssessmentRepository();
  const service = new AssessmentService({ configService, algorithmService, repository });
  return { service, repository, algorithmConfig };
}

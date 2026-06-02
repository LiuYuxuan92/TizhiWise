import { describe, expect, it } from 'vitest';
import {
  AssessmentChannel,
  ConfigKind,
  ConstitutionType,
  Gender,
  QuestionType,
  RedFlagLevel,
} from '@tizhice/shared';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import {
  buildAlgorithmConfig,
  buildAnswersForScores,
} from '../constitution/constitution-test-fixtures';
import { InMemoryAlgorithmConfigRepository } from '../constitution/in-memory-algorithm-config.repository';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import { AssessmentService, IncompleteAssessmentError } from './assessment.service';
import { InMemoryAssessmentRepository } from './in-memory-assessment.repository';
import { defaultQuestionBank } from './question-bank.fixtures';

describe('AssessmentService', () => {
  it('creates a constitution session with locked question-bank and algorithm versions', async () => {
    const { service, configService } = await createService();

    const created = await service.createSession({
      userId: 'user-1',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
      channelSource: 'xiaohongshu',
    });

    expect(created.firstQuestion.type).toBe(QuestionType.LIKERT_5);
    const session = await service.getSession(created.sessionId);
    expect(session).toMatchObject({
      userId: 'user-1',
      channel: AssessmentChannel.CONSTITUTION,
      questionBankVersion: 'v1',
      algorithmVersion: 'v1',
      channelSource: 'xiaohongshu',
    });

    await configService.publish(ConfigKind.QUESTION_BANK, { channels: [] }, 'admin');
    await configService.publish(ConfigKind.ALGORITHM, { thresholds: 'changed' }, 'admin');
    const snapshot = await configService.snapshotForSession(created.sessionId, [
      ConfigKind.QUESTION_BANK,
      ConfigKind.ALGORITHM,
    ]);
    expect(snapshot).toEqual({ QUESTION_BANK: 'v1', ALGORITHM: 'v1' });
  });

  it('stores answers idempotently and returns stable progress for duplicate submissions', async () => {
    const { service, repository } = await createService();
    const { sessionId, firstQuestion } = await service.createSession({
      anonymousId: 'anon-1',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.M, ageBand: '18-25' },
    });

    const first = await service.submitAnswer({
      sessionId,
      questionId: firstQuestion.id,
      value: 5,
      idempotencyKey: 'same-key',
    });
    const duplicate = await service.submitAnswer({
      sessionId,
      questionId: firstQuestion.id,
      value: 5,
      idempotencyKey: 'same-key',
    });

    expect(duplicate).toEqual(first);
    expect(await repository.countAnswers(sessionId)).toBe(1);
    expect(first.progress.answered).toBe(1);
    expect(first.progress.total).toBeGreaterThan(1);
  });

  it('blocks finalize when required answers are missing and reports the first unanswered question', async () => {
    const { service } = await createService();
    const { sessionId, firstQuestion } = await service.createSession({
      anonymousId: 'anon-required',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.OTHER, ageBand: '36-45' },
    });

    await expect(service.finalize(sessionId)).rejects.toMatchObject({
      name: IncompleteAssessmentError.name,
      firstUnansweredQuestionId: firstQuestion.id,
    });
  });

  it('restores an interrupted assessment with exactly the previous answers and current question', async () => {
    const { service } = await createService();
    const { sessionId, firstQuestion } = await service.createSession({
      anonymousId: 'anon-resume',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
    });
    await service.submitAnswer({ sessionId, questionId: firstQuestion.id, value: 4 });

    const resume = await service.getResume({
      anonymousId: 'anon-resume',
      channel: AssessmentChannel.CONSTITUTION,
    });

    expect(resume?.session.id).toBe(sessionId);
    expect(resume?.answers).toEqual([{ questionId: firstQuestion.id, value: 4 }]);
    expect(resume?.currentQuestion?.id).not.toBe(firstQuestion.id);
  });

  it('exposes the next unanswered required question for in-progress sessions', async () => {
    const { service } = await createService();
    const { sessionId, firstQuestion } = await service.createSession({
      anonymousId: 'anon-next-question',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
    });

    await expect(service.getNextQuestion(sessionId)).resolves.toMatchObject({
      id: firstQuestion.id,
    });

    await service.submitAnswer({ sessionId, questionId: firstQuestion.id, value: 4 });

    const nextQuestion = await service.getNextQuestion(sessionId);
    expect(nextQuestion?.id).not.toBe(firstQuestion.id);
  });

  it('returns a non-diagnostic urgent red-flag warning for high-risk pain answers', async () => {
    const { service } = await createService();
    const { sessionId } = await service.createSession({
      anonymousId: 'anon-pain',
      channel: AssessmentChannel.PAIN,
    });

    await service.submitAnswer({ sessionId, questionId: 'pain_severity', value: 9 });
    await service.submitAnswer({ sessionId, questionId: 'pain_duration', value: 'over_72h' });
    const result = await service.submitAnswer({
      sessionId,
      questionId: 'pain_neuro',
      value: ['numbness', 'weakness'],
    });

    expect(result.redFlag).toMatchObject({
      level: RedFlagLevel.URGENT,
      suggestedAction: 'SEEK_MEDICAL_ATTENTION',
    });
    expect(result.redFlag?.message).toContain('非诊断');
  });

  it('finalizes a completed constitution assessment, persists result, and records completion event', async () => {
    const { service, algorithmConfig, repository } = await createService();
    const { sessionId } = await service.createSession({
      userId: 'user-finalize',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.M, ageBand: '26-35' },
    });
    const answers = buildAnswersForScores(algorithmConfig, {
      PINGHE: [5, 5],
      QIXU: [1, 1],
      YANGXU: [1, 1],
      YINXU: [1, 1],
      TANSHI: [1, 1],
      SHIRE: [1, 1],
      XUEYU: [1, 1],
      QIYU: [1, 1],
      TEBING: [1, 1],
    });
    for (const answer of answers) {
      await service.submitAnswer({ sessionId, questionId: answer.questionId, value: answer.score });
    }

    const finalized = await service.finalize(sessionId);
    const stored = await service.getConstitutionResult(finalized.resultId);

    expect(finalized.redirectTo).toBe('REPORT');
    expect(stored).toMatchObject({
      sessionId,
      algorithmVersion: 'v1',
      primary: ConstitutionType.PINGHE,
      isPinghe: true,
    });
    await expect(repository.listEvents()).resolves.toEqual([
      expect.objectContaining({
        type: 'COMPLETE_ASSESSMENT',
        channel: AssessmentChannel.CONSTITUTION,
        userId: 'user-finalize',
        metadata: { sessionId, resultId: finalized.resultId },
      }),
    ]);
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
  return { service, configService, repository, algorithmConfig };
}

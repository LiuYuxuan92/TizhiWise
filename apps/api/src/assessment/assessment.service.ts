import {
  AssessmentChannel,
  BIASED_CONSTITUTION_TYPES,
  CONSTITUTION_TYPES,
  ConstitutionType,
  EventType,
  QuestionType,
  RedFlagLevel,
  SessionStatus,
  type AlgorithmConfig,
  type AssessmentSession,
  type BaseProfile,
  type ConstitutionResult,
  type CreateSessionInput,
  type CreateSessionResult,
  type FinalizeResult,
  type Question,
  type RedFlagWarning,
  type SubmitAnswerInput,
  type SubmitAnswerResult,
  type AnswerValue,
} from '@tizhice/shared';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { ConfigKind } from '@tizhice/shared';
import type {
  InMemoryAssessmentRepository,
  StoredAnswer,
  StoredPainResult,
} from './in-memory-assessment.repository';
import type { QuestionBankConfig } from './question-bank.fixtures';

interface AssessmentServiceDependencies {
  configService: ConfigVersionService;
  algorithmService: ConstitutionAlgoService;
  repository: InMemoryAssessmentRepository;
}

export interface ResumeQuery {
  userId?: string;
  anonymousId?: string;
  channel: AssessmentChannel;
}

export interface ResumeResult {
  session: AssessmentSession;
  answers: Array<{ questionId: string; value: AnswerValue }>;
  currentQuestion: Question | null;
}

export class IncompleteAssessmentError extends Error {
  static override readonly name = 'IncompleteAssessmentError';
  override readonly name = IncompleteAssessmentError.name;

  constructor(readonly firstUnansweredQuestionId: string) {
    super(`Required question is unanswered: ${firstUnansweredQuestionId}`);
  }
}

export class AssessmentService {
  constructor(private readonly dependencies: AssessmentServiceDependencies) {}

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const kinds =
      input.channel === AssessmentChannel.CONSTITUTION
        ? [ConfigKind.QUESTION_BANK, ConfigKind.ALGORITHM]
        : [ConfigKind.QUESTION_BANK];
    const sessionId = this.dependencies.repository.nextSessionId();
    const snapshot = await this.dependencies.configService.snapshotForSession(sessionId, kinds);
    const bank = await this.getQuestionBank(snapshot[ConfigKind.QUESTION_BANK]);
    const questions = questionsForChannel(bank, input.channel);
    if (questions.length === 0) {
      throw new Error(`Question bank has no questions for channel ${input.channel}`);
    }

    const session: AssessmentSession = {
      id: sessionId,
      userId: input.userId ?? null,
      anonymousId: input.anonymousId ?? null,
      channel: input.channel,
      questionBankVersion: snapshot[ConfigKind.QUESTION_BANK],
      algorithmVersion: snapshot[ConfigKind.ALGORITHM],
      baseProfile: input.baseProfile as BaseProfile | undefined,
      status: SessionStatus.IN_PROGRESS,
      startedAt: new Date(),
      resumeQuestionId: questions[0]!.id,
      channelSource: input.channelSource,
    };
    await this.dependencies.repository.saveSession(session);

    return { sessionId, firstQuestion: questions[0]! };
  }

  async getSession(sessionId: string): Promise<AssessmentSession> {
    return this.dependencies.repository.getSessionOrThrow(sessionId);
  }

  async getNextQuestion(sessionId: string): Promise<Question | null> {
    const session = await this.dependencies.repository.getSessionOrThrow(sessionId);
    assertInProgress(session);
    const answers = await this.dependencies.repository.listAnswers(sessionId);
    return this.currentQuestion(session, answers);
  }

  async getResume(query: ResumeQuery): Promise<ResumeResult | null> {
    const session = await this.dependencies.repository.findInProgressSession(query);
    if (!session) {
      return null;
    }
    const answers = await this.dependencies.repository.listAnswers(session.id);
    return {
      session,
      answers: answers.map((answer) => ({ questionId: answer.questionId, value: answer.value })),
      currentQuestion: await this.currentQuestion(session, answers),
    };
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
    const session = await this.dependencies.repository.getSessionOrThrow(input.sessionId);
    assertInProgress(session);
    const bank = await this.getQuestionBank(session.questionBankVersion);
    const question = findQuestion(bank, session.channel, input.questionId);
    validateAnswer(question, input.value);

    const before = await this.dependencies.repository.findAnswerByIdempotencyKey(
      session.id,
      input.idempotencyKey,
    );
    if (before) {
      return this.submitResultFor(session, bank);
    }

    await this.dependencies.repository.upsertAnswer({
      sessionId: session.id,
      questionId: question.id,
      value: input.value,
      idempotencyKey: input.idempotencyKey,
      answeredAt: new Date(),
    });
    const answers = await this.dependencies.repository.listAnswers(session.id);
    session.resumeQuestionId = nextUnansweredQuestion(bank, session.channel, answers)?.id;
    await this.dependencies.repository.saveSession(session);

    return this.submitResultFor(session, bank);
  }

  async reviseAnswer(sessionId: string, questionId: string, value: AnswerValue): Promise<void> {
    await this.submitAnswer({ sessionId, questionId, value });
  }

  async finalize(sessionId: string): Promise<FinalizeResult> {
    const session = await this.dependencies.repository.getSessionOrThrow(sessionId);
    assertInProgress(session);
    const bank = await this.getQuestionBank(session.questionBankVersion);
    const answers = await this.dependencies.repository.listAnswers(sessionId);
    const missing = firstMissingRequiredQuestion(bank, session.channel, answers);
    if (missing) {
      throw new IncompleteAssessmentError(missing.id);
    }

    if (session.channel === AssessmentChannel.CONSTITUTION) {
      if (!session.algorithmVersion) {
        throw new Error('Constitution session is missing algorithmVersion');
      }
      const result = await this.dependencies.algorithmService.judge({
        sessionId: session.id,
        algorithmVersion: session.algorithmVersion,
        answers: answers.map((answer) => ({
          questionId: answer.questionId,
          score: Number(answer.value),
        })),
      });
      await this.dependencies.repository.saveConstitutionResult(result);
      session.status = SessionStatus.SUBMITTED;
      session.submittedAt = new Date();
      await this.dependencies.repository.saveSession(session);
      await this.recordCompletionEvent(session, result.resultId);
      return { resultId: result.resultId, redirectTo: 'REPORT' };
    }

    const redFlag = detectRedFlag(answers);
    const resultId = `pain:${session.id}`;
    await this.dependencies.repository.savePainResult({
      resultId,
      sessionId: session.id,
      ...summarizePainAnswers(answers),
      redFlagLevel: redFlag?.level ?? null,
    });
    session.status = SessionStatus.SUBMITTED;
    session.submittedAt = new Date();
    await this.dependencies.repository.saveSession(session);
    await this.recordCompletionEvent(session, resultId);
    return { resultId, redirectTo: 'REPORT' };
  }

  async getConstitutionResult(resultId: string): Promise<ConstitutionResult> {
    return this.dependencies.repository.getConstitutionResultOrThrow(resultId);
  }

  async getPainResult(resultId: string): Promise<StoredPainResult> {
    return this.dependencies.repository.getPainResultOrThrow(resultId);
  }

  private async submitResultFor(
    session: AssessmentSession,
    bank: QuestionBankConfig,
  ): Promise<SubmitAnswerResult> {
    const answers = await this.dependencies.repository.listAnswers(session.id);
    return {
      progress: {
        answered: new Set(answers.map((answer) => answer.questionId)).size,
        total: questionsForChannel(bank, session.channel).filter((question) => question.required)
          .length,
      },
      redFlag: session.channel === AssessmentChannel.PAIN ? detectRedFlag(answers) : undefined,
    };
  }

  private async currentQuestion(
    session: AssessmentSession,
    answers: readonly StoredAnswer[],
  ): Promise<Question | null> {
    const bank = await this.getQuestionBank(session.questionBankVersion);
    return nextUnansweredQuestion(bank, session.channel, answers);
  }

  private async getQuestionBank(version: string): Promise<QuestionBankConfig> {
    return (await this.dependencies.configService.getVersion(ConfigKind.QUESTION_BANK, version))
      .payload as QuestionBankConfig;
  }

  private async recordCompletionEvent(session: AssessmentSession, resultId: string): Promise<void> {
    await this.dependencies.repository.recordCompletionEvent({
      userId: session.userId ?? undefined,
      anonymousId: session.anonymousId ?? undefined,
      type: EventType.COMPLETE_ASSESSMENT,
      channel: session.channel,
      channelSource: session.channelSource,
      metadata: {
        sessionId: session.id,
        resultId,
      },
    });
  }
}

function questionsForChannel(bank: QuestionBankConfig, channel: AssessmentChannel): Question[] {
  return channel === AssessmentChannel.CONSTITUTION
    ? bank.constitutionQuestions
    : bank.painQuestions;
}

function findQuestion(
  bank: QuestionBankConfig,
  channel: AssessmentChannel,
  questionId: string,
): Question {
  const question = questionsForChannel(bank, channel).find(
    (candidate) => candidate.id === questionId,
  );
  if (!question) {
    throw new Error(`Unknown question ${questionId}`);
  }
  return question;
}

function validateAnswer(question: Question, value: AnswerValue): void {
  switch (question.type) {
    case QuestionType.LIKERT_5:
      if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
        throw new Error(`Question ${question.id} requires a 1-5 score`);
      }
      break;
    case QuestionType.NUMERIC_0_10:
      if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 10) {
        throw new Error(`Question ${question.id} requires a 0-10 score`);
      }
      break;
    case QuestionType.MULTI:
    case QuestionType.BODY_PART:
      if (!Array.isArray(value)) {
        throw new Error(`Question ${question.id} requires an array answer`);
      }
      break;
    case QuestionType.SINGLE:
    case QuestionType.TEXT:
      if (typeof value !== 'string') {
        throw new Error(`Question ${question.id} requires a string answer`);
      }
      break;
    default:
      question.type satisfies never;
  }
}

function firstMissingRequiredQuestion(
  bank: QuestionBankConfig,
  channel: AssessmentChannel,
  answers: readonly StoredAnswer[],
): Question | undefined {
  const answered = new Set(answers.map((answer) => answer.questionId));
  return questionsForChannel(bank, channel).find(
    (question) => question.required && !answered.has(question.id),
  );
}

function nextUnansweredQuestion(
  bank: QuestionBankConfig,
  channel: AssessmentChannel,
  answers: readonly StoredAnswer[],
): Question | null {
  return firstMissingRequiredQuestion(bank, channel, answers) ?? null;
}

function assertInProgress(session: AssessmentSession): void {
  if (session.status !== SessionStatus.IN_PROGRESS) {
    throw new Error(`Session ${session.id} is not in progress`);
  }
}

function detectRedFlag(answers: readonly StoredAnswer[]): RedFlagWarning | undefined {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  const severity = Number(byId.get('pain_severity') ?? 0);
  const duration = byId.get('pain_duration');
  const neuro = byId.get('pain_neuro');
  const neuroFlags = Array.isArray(neuro) ? neuro : [];
  if (
    severity >= 8 &&
    duration === 'over_72h' &&
    neuroFlags.some((flag) => ['numbness', 'weakness'].includes(flag))
  ) {
    return {
      level: RedFlagLevel.URGENT,
      message:
        '出现持续剧烈疼痛并伴随麻木或无力风险信号，请尽快就医。本提示为健康风险提醒，非诊断。',
      suggestedAction: 'SEEK_MEDICAL_ATTENTION',
    };
  }
  return undefined;
}

function summarizePainAnswers(
  answers: readonly StoredAnswer[],
): Pick<StoredPainResult, 'areas' | 'severity'> {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  const areas = byId.get('pain_area');
  const severity = byId.get('pain_severity');
  return {
    areas: Array.isArray(areas) ? areas : undefined,
    severity: typeof severity === 'number' ? severity : null,
  };
}

export function buildDefaultAlgorithmAnswers(
  config: AlgorithmConfig,
): Array<{ questionId: string; score: number }> {
  return config.questionMapping.map((mapping) => ({
    questionId: mapping.questionId,
    score: mapping.constitution === ConstitutionType.PINGHE ? 5 : 1,
  }));
}

export const biasedConstitutionTypesForAssessment = BIASED_CONSTITUTION_TYPES;
export const constitutionTypesForAssessment = CONSTITUTION_TYPES;

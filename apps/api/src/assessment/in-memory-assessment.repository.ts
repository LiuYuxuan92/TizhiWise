import type {
  AssessmentChannel,
  AssessmentSession,
  AnswerValue,
  ConstitutionResult,
  EventType,
} from '@tizhice/shared';
import type { ResumeQuery } from './assessment.service';

export interface StoredAnswer {
  sessionId: string;
  questionId: string;
  value: AnswerValue;
  idempotencyKey?: string;
  answeredAt: Date;
}

interface StoredPainResult {
  resultId: string;
  sessionId: string;
}

export interface StoredAssessmentEvent {
  id: string;
  userId?: string;
  anonymousId?: string;
  type: EventType;
  channel: AssessmentChannel;
  channelSource?: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export class InMemoryAssessmentRepository {
  private sessionCounter = 0;
  private eventCounter = 0;
  private readonly sessions = new Map<string, AssessmentSession>();
  private readonly answers = new Map<string, StoredAnswer[]>();
  private readonly constitutionResults = new Map<string, ConstitutionResult>();
  private readonly painResults = new Map<string, StoredPainResult>();
  private readonly events: StoredAssessmentEvent[] = [];

  nextSessionId(): string {
    this.sessionCounter += 1;
    return `session-${this.sessionCounter}`;
  }

  async saveSession(session: AssessmentSession): Promise<void> {
    this.sessions.set(session.id, cloneSession(session));
  }

  async getSessionOrThrow(sessionId: string): Promise<AssessmentSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return cloneSession(session);
  }

  async findInProgressSession(query: ResumeQuery): Promise<AssessmentSession | null> {
    const sessions = [...this.sessions.values()].filter(
      (session) =>
        session.channel === query.channel &&
        session.status === 'IN_PROGRESS' &&
        ((query.userId && session.userId === query.userId) ||
          (query.anonymousId && session.anonymousId === query.anonymousId)),
    );
    sessions.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
    return sessions[0] ? cloneSession(sessions[0]) : null;
  }

  async upsertAnswer(answer: StoredAnswer): Promise<void> {
    const existing = this.answers.get(answer.sessionId) ?? [];
    const index = existing.findIndex((candidate) => candidate.questionId === answer.questionId);
    const next = cloneAnswer(answer);
    if (index >= 0) {
      existing[index] = next;
    } else {
      existing.push(next);
    }
    this.answers.set(answer.sessionId, existing);
  }

  async findAnswerByIdempotencyKey(
    sessionId: string,
    idempotencyKey?: string,
  ): Promise<StoredAnswer | null> {
    if (!idempotencyKey) {
      return null;
    }
    const answer = (this.answers.get(sessionId) ?? []).find(
      (candidate) => candidate.idempotencyKey === idempotencyKey,
    );
    return answer ? cloneAnswer(answer) : null;
  }

  async listAnswers(sessionId: string): Promise<StoredAnswer[]> {
    return (this.answers.get(sessionId) ?? []).map(cloneAnswer);
  }

  async countAnswers(sessionId: string): Promise<number> {
    return (this.answers.get(sessionId) ?? []).length;
  }

  async saveConstitutionResult(result: ConstitutionResult): Promise<void> {
    this.constitutionResults.set(result.resultId, cloneConstitutionResult(result));
  }

  async getConstitutionResultOrThrow(resultId: string): Promise<ConstitutionResult> {
    const result = this.constitutionResults.get(resultId);
    if (!result) {
      throw new Error(`Constitution result not found: ${resultId}`);
    }
    return cloneConstitutionResult(result);
  }

  async savePainResult(result: StoredPainResult): Promise<void> {
    this.painResults.set(result.resultId, { ...result });
  }

  async recordCompletionEvent(
    event: Omit<StoredAssessmentEvent, 'id' | 'occurredAt'>,
  ): Promise<void> {
    this.eventCounter += 1;
    this.events.push({
      ...event,
      id: `assessment-event-${this.eventCounter}`,
      metadata: { ...event.metadata },
      occurredAt: new Date(),
    });
  }

  async listEvents(): Promise<StoredAssessmentEvent[]> {
    return this.events.map((event) => ({
      ...event,
      metadata: { ...event.metadata },
      occurredAt: new Date(event.occurredAt),
    }));
  }
}

function cloneSession(session: AssessmentSession): AssessmentSession {
  return {
    ...session,
    startedAt: new Date(session.startedAt),
    submittedAt: session.submittedAt ? new Date(session.submittedAt) : undefined,
    baseProfile: session.baseProfile ? { ...session.baseProfile } : undefined,
  };
}

function cloneAnswer(answer: StoredAnswer): StoredAnswer {
  return {
    ...answer,
    value: Array.isArray(answer.value) ? [...answer.value] : answer.value,
    answeredAt: new Date(answer.answeredAt),
  };
}

function cloneConstitutionResult(result: ConstitutionResult): ConstitutionResult {
  return {
    ...result,
    computedAt: new Date(result.computedAt),
    scores: result.scores.map((score) => ({ ...score })),
    concurrent: [...result.concurrent],
  };
}

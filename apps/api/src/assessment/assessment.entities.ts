import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AssessmentChannel, RedFlagLevel, SessionStatus } from '@tizhice/shared';

@Entity('assessment_sessions')
@Index('IDX_assessment_sessions_user_channel_status', ['userId', 'channel', 'status'])
@Index('IDX_assessment_sessions_anonymous_channel_status', ['anonymousId', 'channel', 'status'])
export class AssessmentSessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId!: string | null;

  @Column({ name: 'anonymous_id', type: 'varchar', length: 128, nullable: true })
  anonymousId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  channel!: AssessmentChannel;

  @Column({ name: 'question_bank_version', type: 'varchar', length: 64 })
  questionBankVersion!: string;

  @Column({ name: 'algorithm_version', type: 'varchar', length: 64, nullable: true })
  algorithmVersion!: string | null;

  @Column({ name: 'base_profile_ciphertext', type: 'text', nullable: true })
  baseProfileCiphertext!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: SessionStatus;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'resume_question_id', type: 'varchar', length: 128, nullable: true })
  resumeQuestionId!: string | null;

  @Column({ name: 'channel_source', type: 'varchar', length: 128, nullable: true })
  channelSource!: string | null;
}

@Entity('answers')
@Index('UQ_answers_session_question', ['sessionId', 'questionId'], { unique: true })
@Index('UQ_answers_session_idempotency', ['sessionId', 'idempotencyKey'], {
  unique: true,
  where: 'idempotency_key IS NOT NULL',
})
export class AnswerEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ name: 'question_id', type: 'varchar', length: 128 })
  questionId!: string;

  @Column({ name: 'value_ciphertext', type: 'text' })
  valueCiphertext!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, nullable: true })
  idempotencyKey!: string | null;

  @CreateDateColumn({ name: 'answered_at', type: 'timestamptz' })
  answeredAt!: Date;
}

@Entity('constitution_results')
export class ConstitutionResultEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ name: 'algorithm_version', type: 'varchar', length: 64 })
  algorithmVersion!: string;

  @Column({ name: 'scores_json', type: 'jsonb' })
  scoresJson!: unknown;

  @Column({ name: 'primary_type', type: 'varchar', length: 32 })
  primaryType!: string;

  @Column({ name: 'concurrent_types', type: 'jsonb' })
  concurrentTypes!: unknown;

  @Column({ name: 'is_pinghe', type: 'boolean' })
  isPinghe!: boolean;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamptz' })
  computedAt!: Date;
}

@Entity('pain_results')
export class PainResultEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ name: 'areas_json', type: 'jsonb', nullable: true })
  areasJson!: unknown;

  @Column({ type: 'integer', nullable: true })
  severity!: number | null;

  @Column({ name: 'red_flag_level', type: 'varchar', length: 32, nullable: true })
  redFlagLevel!: RedFlagLevel | null;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamptz' })
  computedAt!: Date;
}

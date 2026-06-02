import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssessmentTables1780362000000 implements MigrationInterface {
  name = 'CreateAssessmentTables1780362000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64),
        anonymous_id varchar(128),
        channel varchar(32) NOT NULL,
        question_bank_version varchar(64) NOT NULL,
        algorithm_version varchar(64),
        base_profile_ciphertext text,
        status varchar(32) NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        submitted_at timestamptz,
        resume_question_id varchar(128),
        channel_source varchar(128)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS IDX_assessment_sessions_user_channel_status ON assessment_sessions (user_id, channel, status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS IDX_assessment_sessions_anonymous_channel_status ON assessment_sessions (anonymous_id, channel, status)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id varchar(64) PRIMARY KEY,
        session_id varchar(64) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        question_id varchar(128) NOT NULL,
        value_ciphertext text NOT NULL,
        idempotency_key varchar(128),
        answered_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT UQ_answers_session_question UNIQUE (session_id, question_id)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS UQ_answers_session_idempotency ON answers (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS constitution_results (
        id varchar(128) PRIMARY KEY,
        session_id varchar(64) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        algorithm_version varchar(64) NOT NULL,
        scores_json jsonb NOT NULL,
        primary_type varchar(32) NOT NULL,
        concurrent_types jsonb NOT NULL,
        is_pinghe boolean NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pain_results (
        id varchar(128) PRIMARY KEY,
        session_id varchar(64) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        areas_json jsonb,
        severity integer,
        red_flag_level varchar(32),
        computed_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS pain_results');
    await queryRunner.query('DROP TABLE IF EXISTS constitution_results');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_answers_session_idempotency');
    await queryRunner.query('DROP TABLE IF EXISTS answers');
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_assessment_sessions_anonymous_channel_status',
    );
    await queryRunner.query('DROP INDEX IF EXISTS IDX_assessment_sessions_user_channel_status');
    await queryRunner.query('DROP TABLE IF EXISTS assessment_sessions');
  }
}

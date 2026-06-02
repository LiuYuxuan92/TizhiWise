import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportTables1780363000000 implements MigrationInterface {
  name = 'CreateReportTables1780363000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64),
        session_id varchar(64) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        type varchar(32) NOT NULL,
        tier varchar(32) NOT NULL,
        template_version varchar(64) NOT NULL,
        payload_ciphertext text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS IDX_reports_user_created_at ON reports (user_id, created_at)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS report_deep_access (
        id varchar(128) PRIMARY KEY,
        report_id varchar(64) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_id varchar(64) NOT NULL,
        order_id varchar(128) NOT NULL,
        granted_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS UQ_report_deep_access_report_user_active ON report_deep_access (report_id, user_id) WHERE revoked_at IS NULL',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS report_share_links (
        token varchar(256) PRIMARY KEY,
        report_id varchar(64) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_id varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS report_export_jobs (
        id varchar(128) PRIMARY KEY,
        report_id varchar(64) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        image_url text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS report_export_jobs');
    await queryRunner.query('DROP TABLE IF EXISTS report_share_links');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_report_deep_access_report_user_active');
    await queryRunner.query('DROP TABLE IF EXISTS report_deep_access');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_reports_user_created_at');
    await queryRunner.query('DROP TABLE IF EXISTS reports');
  }
}

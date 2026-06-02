import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContentMgmtTables1780368000000 implements MigrationInterface {
  name = 'CreateContentMgmtTables1780368000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_drafts (
        id varchar(128) PRIMARY KEY,
        task_id varchar(128) NOT NULL,
        platform varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        title varchar(256) NOT NULL,
        body text NOT NULL,
        script_json jsonb,
        tags jsonb NOT NULL,
        compliance_flags jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        published_by varchar(128),
        published_platform varchar(128)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_content_drafts_platform_status_created
      ON content_drafts (platform, status, created_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_versions (
        id varchar(128) PRIMARY KEY,
        draft_id varchar(128) NOT NULL,
        edited_by varchar(128) NOT NULL,
        edited_at timestamptz NOT NULL DEFAULT now(),
        diff text NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_content_versions_draft_edited
      ON content_versions (draft_id, edited_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS IDX_content_versions_draft_edited');
    await queryRunner.query('DROP TABLE IF EXISTS content_versions');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_content_drafts_platform_status_created');
    await queryRunner.query('DROP TABLE IF EXISTS content_drafts');
  }
}

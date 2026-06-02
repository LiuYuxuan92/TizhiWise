import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrackingTables1780366000000 implements MigrationInterface {
  name = 'CreateTrackingTables1780366000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS behavior_events (
        id varchar(128) PRIMARY KEY,
        user_id varchar(64),
        anonymous_id varchar(128),
        type varchar(64) NOT NULL,
        channel varchar(32),
        channel_source varchar(128),
        metadata jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS IDX_behavior_events_occurred_type ON behavior_events (occurred_at, type)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS aggregate_exports (
        id varchar(128) PRIMARY KEY,
        file_url text NOT NULL,
        group_by varchar(32) NOT NULL,
        rows_json jsonb NOT NULL,
        generated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS aggregate_exports');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_behavior_events_occurred_type');
    await queryRunner.query('DROP TABLE IF EXISTS behavior_events');
  }
}

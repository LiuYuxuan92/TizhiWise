import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContentAiTables1780367000000 implements MigrationInterface {
  name = 'CreateContentAiTables1780367000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_workflow_configs (
        version varchar(64) PRIMARY KEY,
        payload_json jsonb NOT NULL,
        published_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id varchar(128) PRIMARY KEY,
        category varchar(64) NOT NULL,
        content text NOT NULL,
        active boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_gen_tasks (
        id varchar(128) PRIMARY KEY,
        operator_id varchar(128) NOT NULL,
        platforms jsonb NOT NULL,
        topic varchar(256) NOT NULL,
        status varchar(32) NOT NULL,
        workflow_version varchar(64) NOT NULL,
        model_versions_json jsonb NOT NULL,
        prompt_versions_json jsonb NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        failure_reason varchar(128),
        outputs_json jsonb NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS content_gen_tasks');
    await queryRunner.query('DROP TABLE IF EXISTS knowledge_entries');
    await queryRunner.query('DROP TABLE IF EXISTS agent_workflow_configs');
  }
}

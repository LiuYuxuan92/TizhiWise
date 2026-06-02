import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConfigVersions1780320000000 implements MigrationInterface {
  name = 'CreateConfigVersions1780320000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind varchar(64) NOT NULL,
        version varchar(64) NOT NULL,
        payload_json jsonb NOT NULL,
        published_by varchar(128) NOT NULL,
        published_at timestamptz NOT NULL DEFAULT now(),
        active boolean NOT NULL DEFAULT true,
        immutable boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_config_versions_kind_version UNIQUE (kind, version),
        CONSTRAINT ck_config_versions_immutable CHECK (immutable = true)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_config_versions_kind_active
      ON config_versions (kind, active)
      WHERE active = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS UQ_config_versions_kind_active');
    await queryRunner.query('DROP TABLE IF EXISTS config_versions');
  }
}

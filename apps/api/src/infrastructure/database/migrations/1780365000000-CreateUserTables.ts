import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTables1780365000000 implements MigrationInterface {
  name = 'CreateUserTables1780365000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id varchar(64) PRIMARY KEY,
        wx_openid_ciphertext text NOT NULL,
        wx_unionid_ciphertext text,
        nickname varchar(128),
        created_at timestamptz NOT NULL DEFAULT now(),
        consent_scopes jsonb NOT NULL,
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS UQ_users_wx_openid_ciphertext ON users (wx_openid_ciphertext)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS consents (
        id varchar(128) PRIMARY KEY,
        user_id varchar(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope varchar(64) NOT NULL,
        granted_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS IDX_consents_user_scope ON consents (user_id, scope)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS IDX_consents_user_scope');
    await queryRunner.query('DROP TABLE IF EXISTS consents');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_users_wx_openid_ciphertext');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}

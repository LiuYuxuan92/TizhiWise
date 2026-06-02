import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminTables1780369000000 implements MigrationInterface {
  name = 'CreateAdminTables1780369000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id varchar(128) PRIMARY KEY,
        username varchar(128) NOT NULL,
        password_hash varchar(256) NOT NULL,
        role_ids jsonb NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_admin_users_username
      ON admin_users (username)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id varchar(128) PRIMARY KEY,
        name varchar(128) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id varchar(128) PRIMARY KEY,
        description varchar(256) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_role_permissions (
        role_id varchar(128) NOT NULL,
        permission varchar(128) NOT NULL,
        PRIMARY KEY (role_id, permission)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_admin_role_permissions_permission
      ON admin_role_permissions (permission)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id varchar(128) PRIMARY KEY,
        operator varchar(128) NOT NULL,
        action varchar(128) NOT NULL,
        resource varchar(256) NOT NULL,
        before_json jsonb,
        after_json jsonb,
        ip varchar(64) NOT NULL,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_audit_logs_operator_occurred
      ON audit_logs (operator, occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_audit_logs_resource_occurred
      ON audit_logs (resource, occurred_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS IDX_audit_logs_resource_occurred');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_audit_logs_operator_occurred');
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_admin_role_permissions_permission');
    await queryRunner.query('DROP TABLE IF EXISTS admin_role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS admin_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS admin_roles');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_admin_users_username');
    await queryRunner.query('DROP TABLE IF EXISTS admin_users');
  }
}

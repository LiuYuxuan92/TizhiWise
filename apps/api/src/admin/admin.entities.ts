import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AdminPermission } from '@tizhice/shared';

@Entity('admin_users')
@Index('UQ_admin_users_username', ['username'], { unique: true })
export class AdminUserEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 256 })
  passwordHash!: string;

  @Column({ name: 'role_ids', type: 'jsonb' })
  roleIds!: string[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;
}

@Entity('admin_roles')
export class AdminRoleEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;
}

@Entity('admin_permissions')
export class AdminPermissionEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: AdminPermission;

  @Column({ type: 'varchar', length: 256 })
  description!: string;
}

@Entity('admin_role_permissions')
@Index('IDX_admin_role_permissions_permission', ['permission'])
export class AdminRolePermissionEntity {
  @PrimaryColumn({ name: 'role_id', type: 'varchar', length: 128 })
  roleId!: string;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  permission!: AdminPermission;
}

@Entity('audit_logs')
@Index('IDX_audit_logs_operator_occurred', ['operator', 'occurredAt'])
@Index('IDX_audit_logs_resource_occurred', ['resource', 'occurredAt'])
export class AuditLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  operator!: string;

  @Column({ type: 'varchar', length: 128 })
  action!: string;

  @Column({ type: 'varchar', length: 256 })
  resource!: string;

  @Column({ name: 'before_json', type: 'jsonb', nullable: true })
  beforeJson!: unknown | null;

  @Column({ name: 'after_json', type: 'jsonb', nullable: true })
  afterJson!: unknown | null;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}

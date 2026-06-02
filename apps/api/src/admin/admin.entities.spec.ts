import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import {
  AdminPermissionEntity,
  AdminRoleEntity,
  AdminRolePermissionEntity,
  AdminUserEntity,
  AuditLogEntity,
} from './admin.entities';

describe('admin entities', () => {
  it('map admin users, roles, permissions and audit logs', () => {
    expect(tableName(AdminUserEntity)).toBe('admin_users');
    expect(tableName(AdminRoleEntity)).toBe('admin_roles');
    expect(tableName(AdminPermissionEntity)).toBe('admin_permissions');
    expect(tableName(AdminRolePermissionEntity)).toBe('admin_role_permissions');
    expect(tableName(AuditLogEntity)).toBe('audit_logs');

    expect(columnNames(AdminUserEntity)).toEqual(
      expect.arrayContaining(['id', 'username', 'passwordHash', 'roleIds', 'active']),
    );
    expect(columnNames(AdminRolePermissionEntity)).toEqual(
      expect.arrayContaining(['roleId', 'permission']),
    );
    expect(columnNames(AuditLogEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'operator',
        'action',
        'resource',
        'beforeJson',
        'afterJson',
        'ip',
        'occurredAt',
      ]),
    );
  });
});

type EntityConstructor = new (...args: never[]) => unknown;

function tableName(target: EntityConstructor): string | undefined {
  return getMetadataArgsStorage().tables.find((candidate) => candidate.target === target)?.name;
}

function columnNames(target: EntityConstructor): string[] {
  return getMetadataArgsStorage()
    .columns.filter((candidate) => candidate.target === target)
    .map((column) => column.propertyName);
}

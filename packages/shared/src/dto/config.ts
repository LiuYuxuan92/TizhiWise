/**
 * 配置中心与管理后台跨服务 DTO（R11）。
 * 对应 design.md 3.9 ConfigVersionService / AdminService。
 */
import type { AdminPermission, ConfigKind } from '../enums.js';

/** 配置版本（发布即不可变）。 */
export interface ConfigVersion {
  kind: ConfigKind;
  version: string;
  /** 对应类型的 JSON 负载。 */
  payload: unknown;
  publishedBy: string;
  publishedAt: Date;
  /** 当前生效版本。 */
  active: boolean;
  /** 发布后不可改。 */
  immutable: true;
}

/** 发布配置出参。 */
export interface PublishConfigResult {
  version: string;
}

/** 操作审计日志。 */
export interface AuditLog {
  id: string;
  operator: string;
  /** 如 "PUBLISH_ALGORITHM"。 */
  action: string;
  resource: string;
  before?: unknown;
  after?: unknown;
  ip: string;
  occurredAt: Date;
}

/** 管理后台用户。 */
export interface AdminUser {
  id: string;
  username: string;
  roleIds: string[];
  active: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

/** 管理后台角色与权限集合。 */
export interface AdminRole {
  id: string;
  name: string;
  permissions: AdminPermission[];
}

/** 管理端请求上下文。 */
export interface AdminAuthContext {
  operator: string;
  ip: string;
}

/** 后台登录结果。 */
export interface AdminLoginResult {
  token: string;
  user: AdminUser;
  permissions: AdminPermission[];
}

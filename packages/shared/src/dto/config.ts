/**
 * 配置中心与管理后台跨服务 DTO（R11）。
 * 对应 design.md 3.9 ConfigVersionService / AdminService。
 */
import type { ConfigKind } from '../enums.js';

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

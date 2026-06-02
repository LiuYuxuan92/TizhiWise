/**
 * 用户服务跨服务 DTO（R9）。
 * 对应 design.md 3.7 UserService。
 */
import type { ConsentScope } from '../enums.js';
import type { AssessmentSession } from './assessment.js';
import type { PaymentOrder } from './payment.js';
import type { Report } from './report.js';

/** 用户档案。 */
export interface User {
  id: string;
  /** 微信 openid（加密存储）。 */
  wxOpenId: string;
  /** 微信 unionid（加密存储）。 */
  wxUnionId?: string;
  nickname?: string;
  createdAt: Date;
  /** 已授权范围。 */
  consentScopes: ConsentScope[];
  /** 软删 / 匿名化标记。 */
  deletedAt?: Date;
}

/** 单条授权记录。 */
export interface Consent {
  userId: string;
  scope: ConsentScope;
  grantedAt: Date;
  revokedAt?: Date;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 微信登录出参。 */
export interface WechatLoginResult {
  userId: string;
  isNew: boolean;
  token: string;
}

/** 匿名归并入参。 */
export interface MergeAnonymousInput {
  userId: string;
  anonymousId: string;
}

/** 匿名归并出参。 */
export interface MergeAnonymousResult {
  mergedSessions: number;
  mergedReports: number;
  mergedOrders: number;
}

/** "我的"中心出参。 */
export interface MyCenterResult {
  sessions: AssessmentSession[];
  reports: Report[];
  orders: PaymentOrder[];
}

/** 删除请求出参。 */
export interface DeletionResult {
  scheduledAt: Date;
}

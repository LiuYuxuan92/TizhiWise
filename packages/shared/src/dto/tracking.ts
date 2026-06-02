/**
 * 行为追踪与分析服务跨服务 DTO（R10）。
 * 对应 design.md 3.8 TrackingService。
 */
import type { AssessmentChannel, ConstitutionType, EventType } from '../enums.js';

/** 行为埋点事件。 */
export interface BehaviorEvent {
  id: string;
  userId?: string;
  anonymousId?: string;
  type: EventType;
  channel?: AssessmentChannel;
  /** UTM / 渠道码（R10.4）。 */
  channelSource?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

/** 趋势序列单点。 */
export interface TrendPoint {
  occurredAt: Date;
  /** 该时点主体质（体质通道）。 */
  primary?: ConstitutionType;
  /** 该时点疼痛强度（痛症通道，0–10）。 */
  painSeverity?: number;
  metadata?: Record<string, unknown>;
}

/** 复测趋势序列。 */
export interface TrendSeries {
  userId: string;
  channel: AssessmentChannel;
  points: TrendPoint[];
}

/** 运营看板数据。 */
export interface DashboardData {
  completedCount: number;
  paidConversionRate: number;
  /** 各体质分布。 */
  constitutionDistribution: Partial<Record<ConstitutionType, number>>;
  /** 各渠道来源分布。 */
  sourceBreakdown: Record<string, number>;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 追踪事件入参（不含服务端生成的 id）。 */
export type TrackEventInput = Omit<BehaviorEvent, 'id'>;

/** 看板查询筛选条件。 */
export interface DashboardFilters {
  dateRange: [Date, Date];
  channelSource?: string;
}

/** 聚合导出维度。 */
export type AggregateGroupBy = 'CONSTITUTION' | 'AGE_BAND' | 'SOURCE';

/** 聚合导出入参。 */
export interface ExportAggregateInput {
  dateRange: [Date, Date];
  groupBy: AggregateGroupBy;
}

/** 聚合导出出参。 */
export interface ExportAggregateResult {
  fileUrl: string;
}

/**
 * 报告服务跨服务 DTO（R5）。
 * 对应 design.md 3.3 ReportService。
 */
import type {
  ConstitutionType,
  ReportSectionKey,
  ReportTier,
  ReportType,
} from '../enums.js';

/** 片段命中条件。 */
export interface FragmentCondition {
  constitution?: ConstitutionType;
  painArea?: string;
  painSeverityMin?: number;
  /** 主体质 vs 兼夹。 */
  isPrimary?: boolean;
}

/** 片段选择器：按条件命中内容片段。 */
export interface FragmentSelector {
  condition: FragmentCondition;
  fragmentId: string;
  /** 主体质建议优先级高。 */
  priority: number;
}

/** 报告章节定义。 */
export interface ReportSection {
  key: ReportSectionKey;
  /** 基础或深度。 */
  tier: ReportTier;
  fragmentSelectors: FragmentSelector[];
}

/** 报告模板（版本化）。 */
export interface ReportTemplate {
  version: string;
  type: ReportType;
  /** 顺序固定，内容按结果选片段。 */
  sections: ReportSection[];
}

/** 调理建议部分。 */
export interface AdvicePart {
  /** 主体质相关。 */
  forPrimary?: string[];
  /** 兼夹体质相关。 */
  forConcurrent?: Partial<Record<ConstitutionType, string[]>>;
  /** 通用建议。 */
  generic?: string[];
}

/** 深度报告内容（按付费状态决定是否返回全文）。 */
export interface DeepReportContent {
  masked: boolean;
  preview: {
    titles: string[];
    summaries: string[];
  };
  full?: AdvicePart[];
}

/** 已组装的报告内容。 */
export interface ReportPayload {
  overview: string;
  interpretation: string;
  /** "先厨房"——饮食建议。 */
  kitchen: AdvicePart;
  /** 生活方式建议。 */
  lifestyle: AdvicePart;
  /** "后药房"——必要时就医提示。 */
  medicalHint?: AdvicePart;
  /** 非医疗诊断免责声明（模板强制包含）。 */
  disclaimer: string;
  /** 深度内容（含遮罩元数据）。 */
  deep?: DeepReportContent;
}

/** 报告。 */
export interface Report {
  id: string;
  userId: string | null;
  sessionId: string;
  type: ReportType;
  /** 当前用户对该报告的可见层级（基于付费）。 */
  tier: ReportTier;
  templateVersion: string;
  payload: ReportPayload;
  createdAt: Date;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 组装报告入参。 */
export interface AssembleReportInput {
  sessionId: string;
  resultId: string;
}

/** 分享链接出参。 */
export interface ShareLinkResult {
  url: string;
  expiresAt: Date;
}

/** 导出图片出参。 */
export interface ExportImageResult {
  imageUrl: string;
}

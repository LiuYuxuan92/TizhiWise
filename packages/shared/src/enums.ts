/**
 * 跨端共享枚举（领域取值集合）。
 *
 * 设计取舍：本文件采用「`as const` 对象 + 同名联合类型」的模式表达枚举，
 * 而非 TypeScript `enum`。原因：
 *   1. 运行期可枚举取值（`Object.values(...)`），便于校验、迭代与属性测试生成器。
 *   2. 生成的联合类型与设计文档（design.md）中的字符串字面量联合完全一致，
 *      且可直接接收来自 JSON/HTTP 的字符串字面量——这是跨服务 DTO 的关键诉求。
 *   3. 避免 TS `enum` 的标称类型与 CJS/ESM 互操作上的边角问题。
 *
 * 每个枚举提供两个导出：同名的「值对象」与「类型」。值对象用于运行期，
 * 类型用于编译期约束。
 */

/* ────────────────────────────── 体质（R4） ────────────────────────────── */

/** 九种中医体质（ZYYXH/T157-2009）。 */
export const ConstitutionType = {
  /** 平和质 */
  PINGHE: 'PINGHE',
  /** 气虚质 */
  QIXU: 'QIXU',
  /** 阳虚质 */
  YANGXU: 'YANGXU',
  /** 阴虚质 */
  YINXU: 'YINXU',
  /** 痰湿质 */
  TANSHI: 'TANSHI',
  /** 湿热质 */
  SHIRE: 'SHIRE',
  /** 血瘀质 */
  XUEYU: 'XUEYU',
  /** 气郁质 */
  QIYU: 'QIYU',
  /** 特禀质 */
  TEBING: 'TEBING',
} as const;
export type ConstitutionType = (typeof ConstitutionType)[keyof typeof ConstitutionType];

/**
 * 九种体质的标准顺序（平和质在先，其余八种偏颇体质在后）。
 * 算法与报告组装需要稳定的遍历顺序，故在此固化。
 */
export const CONSTITUTION_TYPES: readonly ConstitutionType[] = [
  ConstitutionType.PINGHE,
  ConstitutionType.QIXU,
  ConstitutionType.YANGXU,
  ConstitutionType.YINXU,
  ConstitutionType.TANSHI,
  ConstitutionType.SHIRE,
  ConstitutionType.XUEYU,
  ConstitutionType.QIYU,
  ConstitutionType.TEBING,
] as const;

/** 八种偏颇体质（不含平和质）。 */
export const BIASED_CONSTITUTION_TYPES: readonly ConstitutionType[] = [
  ConstitutionType.QIXU,
  ConstitutionType.YANGXU,
  ConstitutionType.YINXU,
  ConstitutionType.TANSHI,
  ConstitutionType.SHIRE,
  ConstitutionType.XUEYU,
  ConstitutionType.QIYU,
  ConstitutionType.TEBING,
] as const;

/** 单个体质的判定结论。 */
export const ConstitutionJudgment = {
  /** 是（成立，转化分 ≥ 40） */
  YES: 'YES',
  /** 倾向是（转化分 30–39） */
  TENDENCY: 'TENDENCY',
  /** 否（转化分 < 30） */
  NO: 'NO',
} as const;
export type ConstitutionJudgment =
  (typeof ConstitutionJudgment)[keyof typeof ConstitutionJudgment];

/* ────────────────────────────── 测评（R1-R3） ────────────────────────────── */

/** 测评通道：痛症 / 体质。 */
export const AssessmentChannel = {
  PAIN: 'PAIN',
  CONSTITUTION: 'CONSTITUTION',
} as const;
export type AssessmentChannel = (typeof AssessmentChannel)[keyof typeof AssessmentChannel];

/** 测评会话状态。 */
export const SessionStatus = {
  /** 进行中 */
  IN_PROGRESS: 'IN_PROGRESS',
  /** 已提交 */
  SUBMITTED: 'SUBMITTED',
  /** 已放弃 */
  ABANDONED: 'ABANDONED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

/** 题目类型。 */
export const QuestionType = {
  /** 单选 */
  SINGLE: 'SINGLE',
  /** 多选 */
  MULTI: 'MULTI',
  /** 五级李克特量表（1–5） */
  LIKERT_5: 'LIKERT_5',
  /** 0–10 数值量表（如疼痛强度） */
  NUMERIC_0_10: 'NUMERIC_0_10',
  /** 人体部位点选 */
  BODY_PART: 'BODY_PART',
  /** 自由文本 */
  TEXT: 'TEXT',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

/** 红旗征告警级别。 */
export const RedFlagLevel = {
  /** 紧急（建议立即就医） */
  URGENT: 'URGENT',
  /** 警示 */
  WARNING: 'WARNING',
} as const;
export type RedFlagLevel = (typeof RedFlagLevel)[keyof typeof RedFlagLevel];

/** 性别（基础画像）。 */
export const Gender = {
  M: 'M',
  F: 'F',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/* ────────────────────────────── 报告（R5） ────────────────────────────── */

/** 报告层级：基础 / 深度（付费）。 */
export const ReportTier = {
  BASIC: 'BASIC',
  DEEP: 'DEEP',
} as const;
export type ReportTier = (typeof ReportTier)[keyof typeof ReportTier];

/** 报告类型。 */
export const ReportType = {
  CONSTITUTION: 'CONSTITUTION',
  PAIN: 'PAIN',
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

/** 报告章节键（顺序固定，内容按结果选片段）。 */
export const ReportSectionKey = {
  /** 结果概览 */
  OVERVIEW: 'OVERVIEW',
  /** 结果解读 */
  INTERPRETATION: 'INTERPRETATION',
  /** 饮食建议（先厨房） */
  KITCHEN: 'KITCHEN',
  /** 生活方式建议 */
  LIFESTYLE: 'LIFESTYLE',
  /** 必要时就医提示（后药房） */
  WHEN_TO_SEE_DOCTOR: 'WHEN_TO_SEE_DOCTOR',
  /** 免责声明（不可移除） */
  DISCLAIMER: 'DISCLAIMER',
} as const;
export type ReportSectionKey = (typeof ReportSectionKey)[keyof typeof ReportSectionKey];

/* ────────────────────────────── 支付（R6） ────────────────────────────── */

/** 订单状态。 */
export const OrderStatus = {
  /** 待支付 */
  PENDING: 'PENDING',
  /** 已支付 */
  PAID: 'PAID',
  /** 已退款 */
  REFUNDED: 'REFUNDED',
  /** 已关闭 */
  CLOSED: 'CLOSED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** 币种。当前仅支持人民币。 */
export const Currency = {
  CNY: 'CNY',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

/* ────────────────────────────── AI 内容（R7-R8） ────────────────────────────── */

/** Agent 角色。 */
export const AgentRole = {
  /** 选题 Agent */
  TOPIC_PICKER: 'TOPIC_PICKER',
  /** 文案撰写 Agent */
  COPYWRITER: 'COPYWRITER',
  /** 合规审核 Agent */
  COMPLIANCE_REVIEWER: 'COMPLIANCE_REVIEWER',
  /** 配图/素材建议 Agent */
  VISUAL_ADVISOR: 'VISUAL_ADVISOR',
} as const;
export type AgentRole = (typeof AgentRole)[keyof typeof AgentRole];

/** 内容分发目标平台。 */
export const Platform = {
  /** 小红书 */
  XIAOHONGSHU: 'XIAOHONGSHU',
  /** 视频号 */
  VIDEO_CHANNEL: 'VIDEO_CHANNEL',
  /** 朋友圈 */
  MOMENTS: 'MOMENTS',
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

/** AI 内容生成任务状态。 */
export const TaskStatus = {
  /** 已入队 */
  QUEUED: 'QUEUED',
  /** 进行中 */
  IN_PROGRESS: 'IN_PROGRESS',
  /** 已完成 */
  COMPLETED: 'COMPLETED',
  /** 部分失败 */
  PARTIAL_FAILED: 'PARTIAL_FAILED',
  /** 失败 */
  FAILED: 'FAILED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** 内容草稿状态。 */
export const ContentStatus = {
  /** 草稿 */
  DRAFT: 'DRAFT',
  /** 待审 */
  PENDING_REVIEW: 'PENDING_REVIEW',
  /** 已通过 */
  APPROVED: 'APPROVED',
  /** 已发布 */
  PUBLISHED: 'PUBLISHED',
  /** 已废弃 */
  DISCARDED: 'DISCARDED',
  /** 合规风险标记（须人工确认） */
  RISK_FLAGGED: 'RISK_FLAGGED',
} as const;
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

/** 知识库条目分类。 */
export const KnowledgeCategory = {
  /** 品牌调性 */
  BRAND: 'BRAND',
  /** 体质知识 */
  CONSTITUTION: 'CONSTITUTION',
  /** 痛症知识 */
  PAIN: 'PAIN',
  /** 合规规则 */
  COMPLIANCE_RULES: 'COMPLIANCE_RULES',
} as const;
export type KnowledgeCategory = (typeof KnowledgeCategory)[keyof typeof KnowledgeCategory];

/** 内容发布方式。 */
export const PublishMethod = {
  /** 调用平台开放接口发布 */
  API: 'API',
  /** 导出文案/素材供人工发布 */
  EXPORT: 'EXPORT',
} as const;
export type PublishMethod = (typeof PublishMethod)[keyof typeof PublishMethod];

/* ────────────────────────────── 用户（R9） ────────────────────────────── */

/** 用户授权范围（PIPL 明示授权）。 */
export const ConsentScope = {
  /** 基础信息 */
  BASIC: 'BASIC',
  /** 健康数据 */
  HEALTH_DATA: 'HEALTH_DATA',
  /** 行为追踪 */
  BEHAVIOR_TRACKING: 'BEHAVIOR_TRACKING',
  /** 营销触达 */
  MARKETING: 'MARKETING',
} as const;
export type ConsentScope = (typeof ConsentScope)[keyof typeof ConsentScope];

/* ────────────────────────────── 追踪（R10） ────────────────────────────── */

/** 关键用户行为事件类型。 */
export const EventType = {
  /** 进入测评 */
  ENTER_ASSESSMENT: 'ENTER_ASSESSMENT',
  /** 完成测评 */
  COMPLETE_ASSESSMENT: 'COMPLETE_ASSESSMENT',
  /** 查看报告 */
  VIEW_REPORT: 'VIEW_REPORT',
  /** 发起支付 */
  INITIATE_PAYMENT: 'INITIATE_PAYMENT',
  /** 支付成功 */
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  /** 分享 */
  SHARE: 'SHARE',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

/* ────────────────────────────── 配置中心（R11） ────────────────────────────── */

/** 可版本化的配置种类。 */
export const ConfigKind = {
  /** 题库 */
  QUESTION_BANK: 'QUESTION_BANK',
  /** 体质判定算法配置 */
  ALGORITHM: 'ALGORITHM',
  /** 报告模板 */
  REPORT_TEMPLATE: 'REPORT_TEMPLATE',
  /** AI Agent 工作流 */
  AGENT_WORKFLOW: 'AGENT_WORKFLOW',
} as const;
export type ConfigKind = (typeof ConfigKind)[keyof typeof ConfigKind];

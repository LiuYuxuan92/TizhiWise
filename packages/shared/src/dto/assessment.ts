/**
 * 测评服务跨服务 DTO（R1, R2, R3）。
 * 对应 design.md 3.1 AssessmentService。
 */
import type {
  AssessmentChannel,
  ConstitutionType,
  Gender,
  QuestionType,
  RedFlagLevel,
  SessionStatus,
} from '../enums.js';

/** 题目选项。 */
export interface QuestionOption {
  id: string;
  label: string;
  /** 该选项对应的计分（如李克特 1–5）。 */
  score?: number;
}

/** 题目元信息：将题目关联到体质或痛症维度。 */
export interface QuestionMeta {
  /** 体质题：该题归属的体质标签。 */
  constitutionTag?: ConstitutionType;
  /** 痛症题：该题归属的痛症维度。 */
  painDimension?: string;
}

/** 单道题目。 */
export interface Question {
  id: string;
  type: QuestionType;
  required: boolean;
  text: string;
  options?: QuestionOption[];
  meta?: QuestionMeta;
}

/**
 * 作答值。随题型不同而异：
 *   - 数值题（LIKERT_5 / NUMERIC_0_10）→ number
 *   - 单选 → 选项 id（string）
 *   - 多选 / 部位点选 → string[]
 *   - 文本 → string
 */
export type AnswerValue = number | string | string[];

/** 用户基础画像（性别 / 年龄段），加密存储。 */
export interface BaseProfile {
  gender: Gender;
  /** 年龄段，如 "18-25"、"26-35"。 */
  ageBand: string;
}

/** 测评会话。 */
export interface AssessmentSession {
  id: string;
  /** 匿名时为 null，登录后归并回填。 */
  userId: string | null;
  /** 设备 / 匿名标识。 */
  anonymousId: string | null;
  channel: AssessmentChannel;
  /** 快照：会话开始时锁定的题库版本（ADR-2）。 */
  questionBankVersion: string;
  /** 快照：体质通道锁定的算法版本（体质通道才有）。 */
  algorithmVersion?: string;
  baseProfile?: BaseProfile;
  status: SessionStatus;
  startedAt: Date;
  submittedAt?: Date;
  /** 中断时定位的题目，便于恢复。 */
  resumeQuestionId?: string;
  /** UTM / 渠道码（R10.4）。 */
  channelSource?: string;
}

/** 单条作答记录。 */
export interface Answer {
  id: string;
  sessionId: string;
  questionId: string;
  value: AnswerValue;
  answeredAt: Date;
}

/** 红旗征告警（痛症通道）。 */
export interface RedFlagWarning {
  level: RedFlagLevel;
  /** 含"非诊断"声明的提示文案。 */
  message: string;
  suggestedAction: 'SEEK_MEDICAL_ATTENTION';
}

/** 作答进度。 */
export interface AnswerProgress {
  answered: number;
  total: number;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 创建会话入参。 */
export interface CreateSessionInput {
  userId?: string;
  anonymousId?: string;
  channel: AssessmentChannel;
  baseProfile?: BaseProfile;
  /** UTM / 渠道码（R10.4）。 */
  channelSource?: string;
}

/** 创建会话出参。 */
export interface CreateSessionResult {
  sessionId: string;
  firstQuestion: Question;
}

/** 提交作答入参。 */
export interface SubmitAnswerInput {
  sessionId: string;
  questionId: string;
  value: AnswerValue;
  /** 幂等键，防重复提交（P-17）。 */
  idempotencyKey?: string;
}

/** 提交作答出参。 */
export interface SubmitAnswerResult {
  progress: AnswerProgress;
  /** 命中红旗征时返回（痛症通道）。 */
  redFlag?: RedFlagWarning;
}

/** 提交会话出参。 */
export interface FinalizeResult {
  resultId: string;
  redirectTo: 'REPORT';
}

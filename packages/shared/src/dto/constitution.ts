/**
 * 体质判定算法服务跨服务 DTO（R4）。
 * 对应 design.md 3.2 ConstitutionAlgoService。
 */
import type { ConstitutionJudgment, ConstitutionType } from '../enums.js';

/** 算法配置（版本化，发布即不可变）。 */
export interface AlgorithmConfig {
  /** 例: "v2.1"。 */
  version: string;
  publishedAt: Date;
  thresholds: {
    /** 平和质判定阈值：自评分下限 / 偏颇体质上限（默认 60 / 30，上限为开区间）。 */
    pinghe: { selfMin: number; biasedMaxExclusive: number };
    /** 偏颇体质判定阈值：YES / TENDENCY（默认 40 / 30）。 */
    biased: { yes: number; tendency: number };
  };
  /** 题目-体质映射 + 权重。 */
  questionMapping: AlgorithmQuestionMapping[];
}

/** 单条题目到体质的映射。 */
export interface AlgorithmQuestionMapping {
  questionId: string;
  constitution: ConstitutionType;
  /** 默认 1.0。 */
  weight: number;
  /** 反向计分题。 */
  reverseScore?: boolean;
}

/** 单个体质的得分与判定。 */
export interface ConstitutionScore {
  type: ConstitutionType;
  /** 原始分（含权重）。 */
  rawScore: number;
  /** 该体质条目数。 */
  itemCount: number;
  /** 转化分 ∈ [0, 100]。 */
  convertedScore: number;
  judgment: ConstitutionJudgment;
}

/** 体质判定结果。 */
export interface ConstitutionResult {
  resultId: string;
  sessionId: string;
  /** 与本次判定锁定的算法版本。 */
  algorithmVersion: string;
  /** 9 项体质得分。 */
  scores: ConstitutionScore[];
  /** 主体质（最高转化分；平和质规则优先）。 */
  primary: ConstitutionType;
  /** 兼夹体质（按转化分降序）。 */
  concurrent: ConstitutionType[];
  isPinghe: boolean;
  computedAt: Date;
}

/** 单题评分（判定入参，score 取值 1–5）。 */
export interface AnswerScore {
  questionId: string;
  score: number;
}

/** 体质判定入参。 */
export interface JudgeInput {
  answers: AnswerScore[];
  /** 来自会话快照的算法版本。 */
  algorithmVersion: string;
}

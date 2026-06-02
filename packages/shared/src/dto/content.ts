/**
 * AI 内容服务与内容管理服务跨服务 DTO（R7, R8）。
 * 对应 design.md 3.5 ContentAIService 与 3.6 ContentMgmtService。
 */
import type {
  AgentRole,
  ContentStatus,
  KnowledgeCategory,
  Platform,
  PublishMethod,
  TaskStatus,
} from '../enums.js';

/* ───────────────────────── Agent 工作流配置 ───────────────────────── */

/** 单个 Agent 定义。 */
export interface AgentDefinition {
  role: AgentRole;
  /** 模型标识，如 "gpt-4o"、"deepseek-chat"。 */
  model: string;
  /** 提示词模板，可引用 {{platform}}、{{topic}}、{{brandContext}} 等变量。 */
  promptTemplate: string;
  /** 默认 3。 */
  maxRetries: number;
  /** 默认 60000。 */
  timeoutMs: number;
}

/** 工作流编排节点（DAG）。 */
export interface DAGNode {
  agent: AgentRole;
  /** 上游依赖。 */
  dependsOn: AgentRole[];
  /** 同级是否可并行。 */
  parallel?: boolean;
}

/** Agent 工作流配置（版本化）。 */
export interface AgentWorkflowConfig {
  version: string;
  publishedAt: Date;
  agents: AgentDefinition[];
  orchestration: DAGNode[];
}

/** 品牌知识库条目。 */
export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  content: string;
  active: boolean;
}

/* ───────────────────────── 生成任务 ───────────────────────── */

/** 内容草稿引用（任务产物）。 */
export interface ContentDraftRef {
  draftId: string;
  platform: Platform;
}

/** AI 内容生成任务。 */
export interface ContentGenTask {
  id: string;
  /** 发起的运营人员。 */
  operatorId: string;
  platforms: Platform[];
  topic: string;
  status: TaskStatus;
  workflowVersion: string;
  /** 记录各 Agent 所用模型版本（可追溯，R7.12）。 */
  modelVersions: Partial<Record<AgentRole, string>>;
  /** 记录各 Agent 所用 prompt 版本（可追溯，R7.12）。 */
  promptVersions: Partial<Record<AgentRole, string>>;
  startedAt: Date;
  completedAt?: Date;
  /** 失败原因（timeout / rate_limit / model_error）。 */
  failureReason?: string;
  outputs: ContentDraftRef[];
}

/* ───────────────────────── 内容草稿 ───────────────────────── */

/** 视频脚本分镜。 */
export interface VideoScene {
  shotDescription: string;
  narration: string;
  duration?: number;
}

/** 视频号脚本。 */
export interface VideoScript {
  scenes: VideoScene[];
  title: string;
  description: string;
}

/** 内容版本历史项。 */
export interface ContentVersion {
  versionId: string;
  editedBy: string;
  editedAt: Date;
  /** JSON patch 或 plaintext diff。 */
  diff: string;
}

/** 内容草稿。 */
export interface ContentDraft {
  id: string;
  /** 关联的 AI 生成任务。 */
  taskId: string;
  platform: Platform;
  status: ContentStatus;
  title: string;
  /** markdown / 结构化 JSON。 */
  body: string;
  /** 视频号脚本。 */
  scriptStoryboard?: VideoScript;
  /** 标签，如 "痰湿质"、"颈椎痛"。 */
  tags: string[];
  versions: ContentVersion[];
  /** 审核 Agent 标记的风险。 */
  complianceFlags?: string[];
  createdAt: Date;
  publishedAt?: Date;
  publishedBy?: string;
  publishedPlatform?: string;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 分页列表通用包装。 */
export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 创建生成任务入参。 */
export interface CreateContentTaskInput {
  operatorId: string;
  platforms: Platform[];
  topic: string;
  additionalContext?: string;
}

/** 草稿列表筛选条件。 */
export interface ListDraftsFilters {
  platform?: Platform;
  status?: ContentStatus;
  dateRange?: [Date, Date];
  tags?: string[];
}

/** 编辑草稿入参。 */
export interface EditDraftInput {
  title?: string;
  body?: string;
  scriptStoryboard?: VideoScript;
  tags?: string[];
  editedBy: string;
}

/** 发布草稿入参。 */
export interface PublishDraftInput {
  operator: string;
  /** 定时发布时间。 */
  scheduledAt?: Date;
  method: PublishMethod;
}

/** 发布草稿出参。 */
export interface PublishDraftResult {
  publishRef?: string;
  exportUrl?: string;
}

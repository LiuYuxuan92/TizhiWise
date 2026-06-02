import { defineStore } from 'pinia';
import {
  AdminPermission,
  ContentStatus,
  Platform,
  type AdminPermission as AdminPermissionType,
} from '@tizhice/shared';

export interface AdminQuestionDraft {
  id: string;
  channel: 'CONSTITUTION' | 'PAIN';
  text: string;
  type: string;
  required: boolean;
  mapping: string;
}

export interface AdminConfigVersion {
  version: string;
  kind: string;
  summary: string;
  publishedBy: string;
  publishedAt: string;
  active: boolean;
}

export interface AdminContentDraft {
  id: string;
  platform: Platform;
  status: ContentStatus;
  title: string;
  tags: string[];
  risk: boolean;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  operator: string;
  action: string;
  resource: string;
  ip: string;
  occurredAt: string;
}

interface AdminState {
  token: string | null;
  username: string | null;
  permissions: AdminPermissionType[];
  questions: AdminQuestionDraft[];
  versions: AdminConfigVersion[];
  contentDrafts: AdminContentDraft[];
  audits: AdminAuditLog[];
  refundStatus: Record<string, string>;
}

const allPermissions = Object.values(AdminPermission);

export const useAdminStore = defineStore('admin-console', {
  state: (): AdminState => ({
    token: null,
    username: null,
    permissions: [],
    questions: seedQuestions(),
    versions: seedVersions(),
    contentDrafts: seedDrafts(),
    audits: seedAudits(),
    refundStatus: {},
  }),
  getters: {
    isLoggedIn(state): boolean {
      return Boolean(state.token);
    },
    can:
      (state) =>
      (permission: AdminPermissionType): boolean =>
        state.permissions.includes(permission),
    dashboard() {
      return {
        completedAssessments: 1280,
        paidConversion: '18.6%',
        topConstitution: '气虚质 26%',
        topSource: '朋友圈 41%',
      };
    },
  },
  actions: {
    login(username: string, password: string) {
      if (!username || !password) throw new Error('请输入账号和密码');
      this.token = `admin-token-${Date.now()}`;
      this.username = username;
      this.permissions = username === 'viewer' ? [AdminPermission.AUDIT_READ] : allPermissions;
      this.audit('LOGIN', `admin:${username}`);
    },
    logout() {
      this.token = null;
      this.username = null;
      this.permissions = [];
    },
    require(permission: AdminPermissionType) {
      if (!this.can(permission)) throw new Error(`缺少权限：${permission}`);
    },
    upsertQuestion(question: AdminQuestionDraft) {
      this.require(AdminPermission.QUESTION_BANK_WRITE);
      const index = this.questions.findIndex((item) => item.id === question.id);
      if (index >= 0) this.questions[index] = question;
      else this.questions.push(question);
      this.audit(index >= 0 ? 'UPDATE_QUESTION' : 'CREATE_QUESTION', `question:${question.id}`);
    },
    deleteQuestion(id: string) {
      this.require(AdminPermission.QUESTION_BANK_WRITE);
      this.questions = this.questions.filter((question) => question.id !== id);
      this.audit('DELETE_QUESTION', `question:${id}`);
    },
    publishVersion(kind: string, summary: string) {
      const permission = permissionForKind(kind);
      this.require(permission);
      this.versions
        .filter((version) => version.kind === kind)
        .forEach((version) => (version.active = false));
      const next = `v${this.versions.filter((version) => version.kind === kind).length + 1}`;
      this.versions.unshift({
        version: next,
        kind,
        summary,
        publishedBy: this.username ?? 'admin',
        publishedAt: new Date().toISOString(),
        active: true,
      });
      this.audit(`PUBLISH_${kind}`, `config:${kind}`);
    },
    approveDraft(id: string) {
      this.require(AdminPermission.CONTENT_APPROVE);
      const draft = this.findDraft(id);
      draft.status = ContentStatus.APPROVED;
      draft.updatedAt = new Date().toISOString();
      this.audit('APPROVE_CONTENT', `content:${id}`);
    },
    publishDraft(id: string) {
      this.require(AdminPermission.CONTENT_PUBLISH);
      const draft = this.findDraft(id);
      draft.status = ContentStatus.PUBLISHED;
      draft.updatedAt = new Date().toISOString();
      this.audit('PUBLISH_CONTENT', `content:${id}`);
    },
    refund(orderId: string) {
      this.require(AdminPermission.ORDER_REFUND);
      this.refundStatus[orderId] = 'REFUNDED_AND_ACCESS_REVOKED';
      this.audit('REFUND_ORDER', `payment_order:${orderId}`);
    },
    exportAggregate() {
      this.audit('EXPORT_AGGREGATE', 'analytics:aggregate');
      return 'aggregate-export-demo.csv';
    },
    audit(action: string, resource: string) {
      this.audits.unshift({
        id: `audit-${Date.now()}-${this.audits.length + 1}`,
        operator: this.username ?? 'system',
        action,
        resource,
        ip: '127.0.0.1',
        occurredAt: new Date().toISOString(),
      });
    },
    findDraft(id: string): AdminContentDraft {
      const draft = this.contentDrafts.find((item) => item.id === id);
      if (!draft) throw new Error(`草稿不存在：${id}`);
      return draft;
    },
  },
});

function permissionForKind(kind: string): AdminPermissionType {
  switch (kind) {
    case 'QUESTION_BANK':
      return AdminPermission.QUESTION_BANK_WRITE;
    case 'ALGORITHM':
      return AdminPermission.ALGORITHM_WRITE;
    case 'REPORT_TEMPLATE':
      return AdminPermission.REPORT_TEMPLATE_WRITE;
    case 'AGENT_WORKFLOW':
      return AdminPermission.AGENT_WORKFLOW_WRITE;
    default:
      return AdminPermission.AUDIT_READ;
  }
}

function seedQuestions(): AdminQuestionDraft[] {
  return [
    {
      id: 'cq-001',
      channel: 'CONSTITUTION',
      text: '你容易疲乏吗？',
      type: 'LIKERT_5',
      required: true,
      mapping: 'QIXU',
    },
    {
      id: 'cq-002',
      channel: 'CONSTITUTION',
      text: '你手脚容易发凉吗？',
      type: 'LIKERT_5',
      required: true,
      mapping: 'YANGXU',
    },
    {
      id: 'pq-001',
      channel: 'PAIN',
      text: '当前疼痛强度？',
      type: 'NUMERIC_0_10',
      required: true,
      mapping: 'severity',
    },
  ];
}

function seedVersions(): AdminConfigVersion[] {
  return [
    {
      version: 'v1',
      kind: 'QUESTION_BANK',
      summary: '默认体质/痛症题库',
      publishedBy: 'system',
      publishedAt: '2026-06-01T00:00:00Z',
      active: true,
    },
    {
      version: 'v1',
      kind: 'ALGORITHM',
      summary: '九体质默认阈值 40/30',
      publishedBy: 'system',
      publishedAt: '2026-06-01T00:00:00Z',
      active: true,
    },
    {
      version: 'v1',
      kind: 'REPORT_TEMPLATE',
      summary: '含免责声明的基础/深度模板',
      publishedBy: 'system',
      publishedAt: '2026-06-01T00:00:00Z',
      active: true,
    },
    {
      version: 'v1',
      kind: 'AGENT_WORKFLOW',
      summary: '选题-撰写-审核-素材建议 DAG',
      publishedBy: 'system',
      publishedAt: '2026-06-01T00:00:00Z',
      active: true,
    },
  ];
}

function seedDrafts(): AdminContentDraft[] {
  return [
    {
      id: 'draft-1',
      platform: Platform.XIAOHONGSHU,
      status: ContentStatus.PENDING_REVIEW,
      title: '气虚质早餐怎么吃',
      tags: ['气虚质', '早餐'],
      risk: false,
      updatedAt: '2026-06-02T08:00:00Z',
    },
    {
      id: 'draft-2',
      platform: Platform.VIDEO_CHANNEL,
      status: ContentStatus.RISK_FLAGGED,
      title: '颈肩痛三步调理',
      tags: ['颈肩痛'],
      risk: true,
      updatedAt: '2026-06-02T08:10:00Z',
    },
    {
      id: 'draft-3',
      platform: Platform.MOMENTS,
      status: ContentStatus.APPROVED,
      title: '先厨房后药房朋友圈短文',
      tags: ['品牌'],
      risk: false,
      updatedAt: '2026-06-02T08:20:00Z',
    },
  ];
}

function seedAudits(): AdminAuditLog[] {
  return [
    {
      id: 'audit-seed-1',
      operator: 'system',
      action: 'BOOTSTRAP_CONFIG',
      resource: 'config:*',
      ip: '127.0.0.1',
      occurredAt: '2026-06-01T00:00:00Z',
    },
  ];
}

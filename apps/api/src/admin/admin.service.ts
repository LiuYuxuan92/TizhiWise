import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  AdminPermission,
  ConfigKind,
  ReportSectionKey,
  type AdminLoginResult,
  type AdminRole,
  type AdminUser,
  type AgentWorkflowConfig,
  type AuditLog,
  type PublishConfigResult,
  type Question,
  type RefundInput,
  type RefundResult,
} from '@tizhice/shared';
import type { PaymentService } from '../payment/payment.service';
import type { ContentMgmtService } from '../content-mgmt/content-mgmt.service';
import type { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import {
  InMemoryAdminRepository,
  type AuditLogFilters,
  type StoredAdminUser,
} from './in-memory-admin.repository';

type QuestionBankOp = 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH';

interface AdminRequest {
  token: string;
  ip: string;
}

interface CreateAdminUserInput {
  id: string;
  username: string;
  password: string;
  roleIds: string[];
  active?: boolean;
}

interface AdminServiceDependencies {
  repository: InMemoryAdminRepository;
  configService: ConfigVersionService;
  contentMgmtService?: Pick<ContentMgmtService, 'getDraft' | 'approve' | 'publish'>;
  paymentService?: Pick<PaymentService, 'refund'>;
  tokenSecret?: string;
  now?: () => Date;
}

export class AdminService {
  private readonly tokenSecret: string;

  constructor(private readonly dependencies: AdminServiceDependencies) {
    this.tokenSecret = dependencies.tokenSecret ?? 'dev-admin-token-secret-change-me';
  }

  async upsertRole(role: AdminRole): Promise<void> {
    await this.dependencies.repository.saveRole({
      ...role,
      permissions: [...new Set(role.permissions)],
    });
  }

  async createAdminUser(input: CreateAdminUserInput): Promise<AdminUser> {
    const user: StoredAdminUser = {
      id: input.id,
      username: input.username,
      passwordHash: hashPassword(input.password),
      roleIds: [...input.roleIds],
      active: input.active ?? true,
      createdAt: this.now(),
    };
    await this.dependencies.repository.saveUser(user);
    return publicUser(user);
  }

  async login(input: {
    username: string;
    password: string;
    ip: string;
  }): Promise<AdminLoginResult> {
    const user = await this.dependencies.repository.findUserByUsername(input.username);
    if (!user || !user.active || user.passwordHash !== hashPassword(input.password)) {
      throw new Error('Unauthorized admin login');
    }
    const updated = { ...user, lastLoginAt: this.now() };
    await this.dependencies.repository.updateUser(updated);
    const permissions = await this.permissionsFor(updated);
    return {
      token: signToken(updated.id, this.tokenSecret, this.now()),
      user: publicUser(updated),
      permissions,
    };
  }

  async authenticate(token: string): Promise<{ user: AdminUser; permissions: AdminPermission[] }> {
    const userId = verifyToken(token, this.tokenSecret);
    const user = await this.dependencies.repository.findUserById(userId);
    if (!user || !user.active) {
      throw new Error('Unauthorized admin token');
    }
    return { user: publicUser(user), permissions: await this.permissionsFor(user) };
  }

  async requirePermission(token: string, permission: AdminPermission): Promise<AdminUser> {
    const auth = await this.authenticate(token);
    if (!auth.permissions.includes(permission)) {
      throw new Error(`Forbidden: missing permission ${permission}`);
    }
    return auth.user;
  }

  async manageQuestionBank(
    op: QuestionBankOp,
    payload: unknown,
    request: AdminRequest,
  ): Promise<PublishConfigResult | { ok: true }> {
    const operator = await this.authorize(request, AdminPermission.QUESTION_BANK_WRITE);
    if (op === 'PUBLISH') {
      const before = await this.tryGetActive(ConfigKind.QUESTION_BANK);
      const questions = await this.dependencies.repository.listQuestionDrafts();
      const result = await this.dependencies.configService.publish(
        ConfigKind.QUESTION_BANK,
        { questions },
        operator.id,
      );
      await this.audit({
        operator: operator.id,
        action: 'PUBLISH_QUESTION_BANK',
        resource: 'config:QUESTION_BANK',
        before,
        after: { version: result.version, questionCount: questions.length },
        ip: request.ip,
      });
      return result;
    }

    if (op === 'DELETE') {
      const questionId = questionIdFrom(payload);
      const before = await this.dependencies.repository.getQuestionDraft(questionId);
      await this.dependencies.repository.deleteQuestionDraft(questionId);
      await this.audit({
        operator: operator.id,
        action: 'DELETE_QUESTION',
        resource: `question:${questionId}`,
        before,
        after: undefined,
        ip: request.ip,
      });
      return { ok: true };
    }

    const question = normalizeQuestion(payload);
    const before = await this.dependencies.repository.getQuestionDraft(question.id);
    await this.dependencies.repository.saveQuestionDraft(question);
    await this.audit({
      operator: operator.id,
      action: `${op}_QUESTION`,
      resource: `question:${question.id}`,
      before,
      after: question,
      ip: request.ip,
    });
    return { ok: true };
  }

  async manageAlgorithmConfig(
    payload: unknown,
    request: AdminRequest,
  ): Promise<PublishConfigResult> {
    const operator = await this.authorize(request, AdminPermission.ALGORITHM_WRITE);
    const before = await this.tryGetActive(ConfigKind.ALGORITHM);
    const result = await this.dependencies.configService.publish(
      ConfigKind.ALGORITHM,
      payload,
      operator.id,
    );
    await this.audit({
      operator: operator.id,
      action: 'PUBLISH_ALGORITHM',
      resource: 'config:ALGORITHM',
      before,
      after: { version: result.version, payload },
      ip: request.ip,
    });
    return result;
  }

  async manageReportTemplate(
    payload: unknown,
    request: AdminRequest,
  ): Promise<PublishConfigResult> {
    const operator = await this.authorize(request, AdminPermission.REPORT_TEMPLATE_WRITE);
    assertHasDisclaimer(payload);
    const before = await this.tryGetActive(ConfigKind.REPORT_TEMPLATE);
    const result = await this.dependencies.configService.publish(
      ConfigKind.REPORT_TEMPLATE,
      payload,
      operator.id,
    );
    await this.audit({
      operator: operator.id,
      action: 'PUBLISH_REPORT_TEMPLATE',
      resource: 'config:REPORT_TEMPLATE',
      before,
      after: { version: result.version },
      ip: request.ip,
    });
    return result;
  }

  async manageAgentWorkflow(
    payload: AgentWorkflowConfig,
    request: AdminRequest,
  ): Promise<PublishConfigResult> {
    const operator = await this.authorize(request, AdminPermission.AGENT_WORKFLOW_WRITE);
    assertWorkflowConfig(payload);
    const before = await this.tryGetActive(ConfigKind.AGENT_WORKFLOW);
    const result = await this.dependencies.configService.publish(
      ConfigKind.AGENT_WORKFLOW,
      payload,
      operator.id,
    );
    await this.audit({
      operator: operator.id,
      action: 'PUBLISH_AGENT_WORKFLOW',
      resource: 'config:AGENT_WORKFLOW',
      before,
      after: { version: result.version, workflowVersion: payload.version },
      ip: request.ip,
    });
    return result;
  }

  async approveContent(draftId: string, request: AdminRequest): Promise<void> {
    const operator = await this.authorize(request, AdminPermission.CONTENT_APPROVE);
    if (!this.dependencies.contentMgmtService) {
      throw new Error('Content management service is not configured');
    }
    const before = await this.dependencies.contentMgmtService.getDraft(draftId);
    await this.dependencies.contentMgmtService.approve(draftId, operator.id);
    const after = await this.dependencies.contentMgmtService.getDraft(draftId);
    await this.audit({
      operator: operator.id,
      action: 'APPROVE_CONTENT',
      resource: `content_draft:${draftId}`,
      before,
      after,
      ip: request.ip,
    });
  }

  async publishContent(
    draftId: string,
    input: Parameters<ContentMgmtService['publish']>[1],
    request: AdminRequest,
  ) {
    const operator = await this.authorize(request, AdminPermission.CONTENT_PUBLISH);
    if (!this.dependencies.contentMgmtService) {
      throw new Error('Content management service is not configured');
    }
    const before = await this.dependencies.contentMgmtService.getDraft(draftId);
    const result = await this.dependencies.contentMgmtService.publish(draftId, {
      ...input,
      operator: operator.id,
    });
    const after = await this.dependencies.contentMgmtService.getDraft(draftId);
    await this.audit({
      operator: operator.id,
      action: 'PUBLISH_CONTENT',
      resource: `content_draft:${draftId}`,
      before,
      after,
      ip: request.ip,
    });
    return result;
  }

  async refundOrder(
    input: Omit<RefundInput, 'operator'>,
    request: AdminRequest,
  ): Promise<RefundResult> {
    const operator = await this.authorize(request, AdminPermission.ORDER_REFUND);
    if (!this.dependencies.paymentService) {
      throw new Error('Payment service is not configured');
    }
    const result = await this.dependencies.paymentService.refund({
      ...input,
      operator: operator.id,
    });
    await this.audit({
      operator: operator.id,
      action: 'REFUND_ORDER',
      resource: `payment_order:${input.orderId}`,
      before: undefined,
      after: result,
      ip: request.ip,
    });
    return result;
  }

  async listAuditLogs(request: AdminRequest, filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    await this.authorize(request, AdminPermission.AUDIT_READ);
    return this.dependencies.repository.listAuditLogs(filters);
  }

  private async authorize(request: AdminRequest, permission: AdminPermission): Promise<AdminUser> {
    return this.requirePermission(request.token, permission);
  }

  private async permissionsFor(user: AdminUser): Promise<AdminPermission[]> {
    const roles = await this.dependencies.repository.listRolesByIds(user.roleIds);
    return [...new Set(roles.flatMap((role) => role.permissions))];
  }

  private async tryGetActive(kind: ConfigKind) {
    try {
      return await this.dependencies.configService.getActive(kind);
    } catch {
      return undefined;
    }
  }

  private async audit(input: Omit<AuditLog, 'id' | 'occurredAt'>): Promise<void> {
    await this.dependencies.repository.saveAuditLog({
      ...input,
      id: this.dependencies.repository.nextAuditId(),
      occurredAt: this.now(),
    });
  }

  private now(): Date {
    return new Date((this.dependencies.now?.() ?? new Date()).getTime());
  }
}

function hashPassword(password: string): string {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

function signToken(userId: string, secret: string, issuedAt: Date): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: issuedAt.toISOString() }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `admin.${payload}.${signature}`;
}

function verifyToken(token: string, secret: string): string {
  const [prefix, payload, signature] = token.split('.');
  if (prefix !== 'admin' || !payload || !signature) {
    throw new Error('Unauthorized admin token');
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) {
    throw new Error('Unauthorized admin token');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sub?: string;
  };
  if (!parsed.sub) {
    throw new Error('Unauthorized admin token');
  }
  return parsed.sub;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function publicUser(user: StoredAdminUser): AdminUser {
  return {
    id: user.id,
    username: user.username,
    roleIds: [...user.roleIds],
    active: user.active,
    createdAt: new Date(user.createdAt),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
  };
}

function normalizeQuestion(payload: unknown): Question {
  const question = payload as Partial<Question>;
  if (!question || typeof question.id !== 'string' || typeof question.text !== 'string') {
    throw new Error('Invalid question payload');
  }
  if (typeof question.required !== 'boolean' || typeof question.type !== 'string') {
    throw new Error('Invalid question payload');
  }
  return question as Question;
}

function questionIdFrom(payload: unknown): string {
  const questionId = (payload as { id?: unknown })?.id;
  if (typeof questionId !== 'string' || questionId.length === 0) {
    throw new Error('Invalid question id payload');
  }
  return questionId;
}

function assertHasDisclaimer(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (
    !serialized.includes(ReportSectionKey.DISCLAIMER) &&
    !serialized.includes('免责声明') &&
    !serialized.includes('非医疗诊断')
  ) {
    throw new Error('Report template must keep disclaimer content');
  }
}

function assertWorkflowConfig(payload: AgentWorkflowConfig): void {
  if (!payload.version || !Array.isArray(payload.agents) || !Array.isArray(payload.orchestration)) {
    throw new Error('Invalid agent workflow config');
  }
}

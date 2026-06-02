import { describe, expect, it } from 'vitest';
import {
  AdminPermission,
  ConfigKind,
  QuestionType,
  type RefundInput,
  type RefundResult,
} from '@tizhice/shared';
import { defaultAgentWorkflow } from '../content-ai/content-ai.fixtures';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import { defaultReportTemplatePayload } from '../report/report.fixtures';
import { AdminService } from './admin.service';
import { InMemoryAdminRepository } from './in-memory-admin.repository';

describe('AdminService', () => {
  it('authenticates admins and denies operations by default without explicit permission', async () => {
    const { service } = createService();
    await service.upsertRole({ id: 'viewer', name: 'Viewer', permissions: [] });
    await service.createAdminUser({
      id: 'admin-viewer',
      username: 'viewer',
      password: 'secret',
      roleIds: ['viewer'],
    });

    const login = await service.login({ username: 'viewer', password: 'secret', ip: '127.0.0.1' });
    expect(login.permissions).toEqual([]);

    await expect(
      service.manageAlgorithmConfig({ threshold: 40 }, { token: login.token, ip: '127.0.0.1' }),
    ).rejects.toThrow(/Forbidden/);
  });

  it('publishes question bank and algorithm config with RBAC and audit logs', async () => {
    const { service, configService } = createService();
    const token = await loginAs(service, [
      AdminPermission.QUESTION_BANK_WRITE,
      AdminPermission.ALGORITHM_WRITE,
      AdminPermission.AUDIT_READ,
    ]);

    await service.manageQuestionBank(
      'CREATE',
      {
        id: 'q-1',
        type: QuestionType.LIKERT_5,
        required: true,
        text: '你容易疲乏吗？',
        options: [{ id: '1', label: '没有', score: 1 }],
      },
      { token, ip: '10.0.0.1' },
    );
    const questionBank = await service.manageQuestionBank('PUBLISH', {}, { token, ip: '10.0.0.1' });
    expect(questionBank).toEqual({ version: 'v1' });
    await expect(configService.getActive(ConfigKind.QUESTION_BANK)).resolves.toMatchObject({
      payload: {
        questions: [
          expect.objectContaining({
            id: 'q-1',
            text: '你容易疲乏吗？',
          }),
        ],
      },
      publishedBy: 'root',
    });

    await service.manageAlgorithmConfig(
      { thresholds: { biased: { yes: 40 } } },
      { token, ip: '10.0.0.1' },
    );
    await expect(configService.getActive(ConfigKind.ALGORITHM)).resolves.toMatchObject({
      version: 'v1',
      publishedBy: 'root',
    });

    const logs = await service.listAuditLogs({ token, ip: '10.0.0.1' });
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining(['CREATE_QUESTION', 'PUBLISH_QUESTION_BANK', 'PUBLISH_ALGORITHM']),
    );
    expect(logs.every((log) => log.operator === 'root' && log.ip === '10.0.0.1')).toBe(true);
  });

  it('publishes report templates and agent workflows only after validation', async () => {
    const { service, configService } = createService();
    const token = await loginAs(service, [
      AdminPermission.REPORT_TEMPLATE_WRITE,
      AdminPermission.AGENT_WORKFLOW_WRITE,
      AdminPermission.AUDIT_READ,
    ]);

    await expect(
      service.manageReportTemplate(
        { fragments: { overview: 'no disclaimer' } },
        { token, ip: '127.0.0.1' },
      ),
    ).rejects.toThrow(/disclaimer/);

    await service.manageReportTemplate(defaultReportTemplatePayload('admin-v1'), {
      token,
      ip: '127.0.0.1',
    });
    await service.manageAgentWorkflow(defaultAgentWorkflow('workflow-v1'), {
      token,
      ip: '127.0.0.1',
    });

    await expect(configService.getActive(ConfigKind.REPORT_TEMPLATE)).resolves.toMatchObject({
      version: 'v1',
    });
    await expect(configService.getActive(ConfigKind.AGENT_WORKFLOW)).resolves.toMatchObject({
      payload: expect.objectContaining({ version: 'workflow-v1' }),
    });
    await expect(service.listAuditLogs({ token, ip: '127.0.0.1' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'PUBLISH_REPORT_TEMPLATE' }),
        expect.objectContaining({ action: 'PUBLISH_AGENT_WORKFLOW' }),
      ]),
    );
  });

  it('wraps refund operations with permission checks and audit logs', async () => {
    const { service } = createService({
      paymentService: {
        refund: async (input: RefundInput): Promise<RefundResult> => ({
          refundId: `refund-${input.orderId}-${input.operator}`,
        }),
      },
    });
    const token = await loginAs(service, [
      AdminPermission.ORDER_REFUND,
      AdminPermission.AUDIT_READ,
    ]);

    const result = await service.refundOrder(
      { orderId: 'order-1', reason: '用户申请' },
      { token, ip: '172.16.0.1' },
    );

    expect(result.refundId).toBe('refund-order-1-root');
    await expect(service.listAuditLogs({ token, ip: '172.16.0.1' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'REFUND_ORDER',
          resource: 'payment_order:order-1',
          after: result,
        }),
      ]),
    );
  });
});

function createService(overrides: Partial<ConstructorParameters<typeof AdminService>[0]> = {}) {
  const repository = new InMemoryAdminRepository();
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  const service = new AdminService({
    repository,
    configService,
    tokenSecret: 'test-secret',
    now: () => new Date('2026-06-02T08:00:00Z'),
    ...overrides,
  });
  return { repository, configService, service };
}

async function loginAs(service: AdminService, permissions: AdminPermission[]): Promise<string> {
  await service.upsertRole({ id: 'root-role', name: 'Root', permissions });
  await service.createAdminUser({
    id: 'root',
    username: 'root',
    password: 'secret',
    roleIds: ['root-role'],
  });
  const login = await service.login({ username: 'root', password: 'secret', ip: '127.0.0.1' });
  return login.token;
}

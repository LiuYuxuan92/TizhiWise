import { describe, expect, it } from 'vitest';
import {
  AssessmentChannel,
  ConfigKind,
  ContentStatus,
  Gender,
  Platform,
  PublishMethod,
  QuestionType,
  ReportSectionKey,
  type AnswerValue,
} from '@tizhice/shared';
import { AdminService } from '../admin/admin.service';
import { InMemoryAdminRepository } from '../admin/in-memory-admin.repository';
import { AssessmentService } from '../assessment/assessment.service';
import { InMemoryAssessmentRepository } from '../assessment/in-memory-assessment.repository';
import { defaultQuestionBank, type QuestionBankConfig } from '../assessment/question-bank.fixtures';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import {
  buildAlgorithmConfig,
  buildAnswersForScores,
} from '../constitution/constitution-test-fixtures';
import { InMemoryAlgorithmConfigRepository } from '../constitution/in-memory-algorithm-config.repository';
import { ContentAIService } from '../content-ai/content-ai.service';
import { InMemoryContentAiRepository } from '../content-ai/in-memory-content-ai.repository';
import { DeterministicLlmProvider } from '../content-ai/llm-provider';
import { ContentMgmtService } from '../content-mgmt/content-mgmt.service';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import {
  redactSensitive,
  retryWithFallback,
  signJwtLike,
} from '../infrastructure/gateway/security-utils';
import {
  InMemoryPaymentRepository,
  anonymousUserIdFor,
} from '../payment/in-memory-payment.repository';
import { PaymentService } from '../payment/payment.service';
import { validCallback } from '../payment/payment-test-fixtures';
import { DeterministicWechatPayGateway } from '../payment/wechat-pay.gateway';
import { InMemoryReportRepository } from '../report/in-memory-report.repository';
import { defaultReportTemplatePayload } from '../report/report.fixtures';
import { ReportService } from '../report/report.service';
import { InMemoryUserRepository } from '../user/in-memory-user.repository';
import { DeterministicWechatIdentityProvider, UserService } from '../user/user.service';

async function createPlatformFixture() {
  const algorithmConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  await configService.publish(
    ConfigKind.QUESTION_BANK,
    defaultQuestionBank(algorithmConfig),
    'seed',
  );
  await configService.publish(ConfigKind.ALGORITHM, algorithmConfig, 'seed');
  await configService.publish(ConfigKind.REPORT_TEMPLATE, defaultReportTemplatePayload(), 'seed');

  const assessmentRepository = new InMemoryAssessmentRepository();
  const assessmentService = new AssessmentService({
    configService,
    algorithmService: new ConstitutionAlgoService(
      new InMemoryAlgorithmConfigRepository([algorithmConfig]),
    ),
    repository: assessmentRepository,
  });
  const reportRepository = new InMemoryReportRepository();
  const reportService = new ReportService({
    configService,
    assessmentService,
    repository: reportRepository,
  });
  const paymentRepository = new InMemoryPaymentRepository();
  const paymentService = new PaymentService({
    repository: paymentRepository,
    reportService,
    wechatGateway: new DeterministicWechatPayGateway(),
  });
  const userService = new UserService({
    users: new InMemoryUserRepository(),
    assessmentRepository,
    reportRepository,
    paymentRepository,
    reportService,
    wechat: new DeterministicWechatIdentityProvider(),
  });
  const contentRepository = new InMemoryContentAiRepository();
  const contentAiService = new ContentAIService({
    repository: contentRepository,
    llm: new DeterministicLlmProvider(),
  });
  const contentMgmtService = new ContentMgmtService({ repository: contentRepository });
  const adminService = new AdminService({
    repository: new InMemoryAdminRepository(),
    configService,
    contentMgmtService,
    paymentService,
    tokenSecret: 'e2e-secret',
  });

  return {
    algorithmConfig,
    configService,
    assessmentService,
    reportService,
    paymentService,
    userService,
    contentAiService,
    contentMgmtService,
    adminService,
  };
}

describe('platform E2E acceptance flows', () => {
  it('16.1 constitution assessment end-to-end: entry -> answers -> result -> basic report', async () => {
    const fx = await createPlatformFixture();
    const { sessionId } = await fx.assessmentService.createSession({
      userId: 'u-constitution',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
      channelSource: 'wechat-moments',
    });
    const answers = buildAnswersForScores(fx.algorithmConfig, { PINGHE: [1, 1], QIXU: [5, 5] });
    for (const answer of answers) {
      await fx.assessmentService.submitAnswer({
        sessionId,
        questionId: answer.questionId,
        value: answer.score,
      });
    }
    const finalized = await fx.assessmentService.finalize(sessionId);
    const result = await fx.assessmentService.getConstitutionResult(finalized.resultId);
    const report = await fx.reportService.assemble({ sessionId, resultId: finalized.resultId });

    expect(result.primary).toBe('QIXU');
    expect(report.payload.disclaimer).toContain('不构成医疗诊断');
    expect(report.payload.deep?.masked).toBe(true);
  });

  it('16.2 pain red-flag flow shows non-diagnostic medical warning and report', async () => {
    const fx = await createPlatformFixture();
    const { sessionId } = await fx.assessmentService.createSession({
      anonymousId: 'anon-pain',
      channel: AssessmentChannel.PAIN,
    });
    const bank: QuestionBankConfig = defaultQuestionBank(fx.algorithmConfig);
    let sawRedFlag = false;
    for (const question of bank.painQuestions) {
      const submit = await fx.assessmentService.submitAnswer({
        sessionId,
        questionId: question.id,
        value: painAnswerFor(question.id, question.type),
      });
      sawRedFlag = sawRedFlag || Boolean(submit.redFlag?.message.includes('非诊断'));
    }
    const finalized = await fx.assessmentService.finalize(sessionId);
    const report = await fx.reportService.assemble({ sessionId, resultId: finalized.resultId });
    expect(sawRedFlag).toBe(true);
    expect(report.payload.medicalHint?.generic?.join('\n')).toContain('非诊断');
  });

  it('16.3 payment unlock flow: basic report -> order -> callback -> deep access -> duplicate prevention', async () => {
    const fx = await createPlatformFixture();
    const { sessionId } = await fx.assessmentService.createSession({
      userId: 'pay-user',
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.M, ageBand: '36-45' },
    });
    for (const answer of buildAnswersForScores(fx.algorithmConfig, {
      PINGHE: [1, 1],
      TANSHI: [5, 5],
    })) {
      await fx.assessmentService.submitAnswer({
        sessionId,
        questionId: answer.questionId,
        value: answer.score,
      });
    }
    const finalized = await fx.assessmentService.finalize(sessionId);
    const report = await fx.reportService.assemble({ sessionId, resultId: finalized.resultId });
    const order = await fx.paymentService.createOrder({
      userId: 'pay-user',
      reportId: report.id,
      idempotencyKey: 'idem-1',
    });
    const callback = validCallback(order.orderId);
    await fx.paymentService.handleCallback(callback.rawBody, callback.headers);

    await expect(fx.reportService.getReport(report.id, 'pay-user')).resolves.toMatchObject({
      payload: { deep: { masked: false } },
    });
    await expect(
      fx.paymentService.createOrder({
        userId: 'pay-user',
        reportId: report.id,
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toThrow(/already paid/);
  });

  it('16.4 anonymous merge flow: anonymous answer -> wechat login -> my center sees reports and orders', async () => {
    const fx = await createPlatformFixture();
    const anonymousId = 'anon-merge-e2e';
    const { sessionId } = await fx.assessmentService.createSession({
      anonymousId,
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
    });
    for (const answer of buildAnswersForScores(fx.algorithmConfig, {
      PINGHE: [1, 1],
      YANGXU: [5, 5],
    })) {
      await fx.assessmentService.submitAnswer({
        sessionId,
        questionId: answer.questionId,
        value: answer.score,
      });
    }
    const finalized = await fx.assessmentService.finalize(sessionId);
    const report = await fx.reportService.assemble({ sessionId, resultId: finalized.resultId });
    await fx.paymentService.createOrder({
      userId: anonymousUserIdFor(anonymousId),
      reportId: report.id,
      idempotencyKey: 'anon-order',
    });
    const login = await fx.userService.wechatLogin('merge-code');
    await fx.userService.mergeAnonymous({ userId: login.userId, anonymousId });
    const center = await fx.userService.getMyCenter(login.userId);

    expect(center.sessions).toHaveLength(1);
    expect(center.reports).toHaveLength(1);
    expect(center.orders).toHaveLength(1);
  });

  it('16.5 AI content generation to manual approval and publish/export', async () => {
    const fx = await createPlatformFixture();
    await fx.contentAiService.bootstrapDefaults();
    const created = await fx.contentAiService.createTask({
      operatorId: 'ops',
      platforms: [Platform.XIAOHONGSHU],
      topic: '气虚质早餐',
    });
    const task = await fx.contentAiService.getTaskStatus(created.taskId);
    const draftId = task.outputs[0]!.draftId;
    await fx.contentMgmtService.submitForReview(draftId, { operator: 'ops', confirmRisk: true });
    await fx.contentMgmtService.approve(draftId, 'reviewer');
    const result = await fx.contentMgmtService.publish(draftId, {
      operator: 'publisher',
      method: PublishMethod.EXPORT,
    });
    const draft = await fx.contentMgmtService.getDraft(draftId);

    expect(draft.status).toBe(ContentStatus.PUBLISHED);
    expect(result.exportUrl).toContain(draftId);
  });

  it('16.6 config snapshot: in-progress session keeps old versions while new session uses new versions', async () => {
    const fx = await createPlatformFixture();
    const oldSession = await fx.assessmentService.createSession({
      userId: 'snapshot-user',
      channel: AssessmentChannel.CONSTITUTION,
    });
    await fx.configService.publish(
      ConfigKind.QUESTION_BANK,
      defaultQuestionBank(fx.algorithmConfig),
      'admin-v2',
    );
    await fx.configService.publish(
      ConfigKind.ALGORITHM,
      { ...fx.algorithmConfig, version: 'v2' },
      'admin-v2',
    );
    const newSession = await fx.assessmentService.createSession({
      userId: 'snapshot-user',
      channel: AssessmentChannel.CONSTITUTION,
    });
    const oldRecord = await fx.assessmentService.getSession(oldSession.sessionId);
    const newRecord = await fx.assessmentService.getSession(newSession.sessionId);

    expect(oldRecord.questionBankVersion).toBe('v1');
    expect(oldRecord.algorithmVersion).toBe('v1');
    expect(newRecord.questionBankVersion).toBe('v2');
    expect(newRecord.algorithmVersion).toBe('v2');
  });

  it('16.7 security and compliance checks cover replay-sensitive inputs, redacted logs and disclaimer', async () => {
    const token = signJwtLike({ sub: 'u1', permissions: ['AUDIT_READ'] }, 'secret');
    expect(token.split('.')).toHaveLength(3);
    expect(
      redactSensitive({ openid: 'wx', rawCallback: 'callback', nested: { answer: 'health' } }),
    ).toEqual({
      openid: '[REDACTED]',
      rawCallback: '[REDACTED]',
      nested: { answer: '[REDACTED]' },
    });
    await expect(
      retryWithFallback({
        operation: async () => {
          throw new Error('ai timeout');
        },
        fallback: () => 'degraded',
        retries: 1,
      }),
    ).resolves.toBe('degraded');
    expect(JSON.stringify(defaultReportTemplatePayload())).toContain(ReportSectionKey.DISCLAIMER);
  });
});

function painAnswerFor(questionId: string, type: QuestionType): AnswerValue {
  if (questionId === 'pain_severity') return 9;
  if (questionId === 'pain_trigger') return ['night'];
  if (questionId === 'pain_neuro') return ['weakness'];
  if (type === QuestionType.BODY_PART) return ['neck'];
  if (type === QuestionType.MULTI) return ['sharp'];
  if (type === QuestionType.SINGLE) return 'over_72h';
  return 'text';
}

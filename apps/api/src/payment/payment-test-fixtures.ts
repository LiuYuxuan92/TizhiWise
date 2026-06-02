import { AssessmentChannel, ConfigKind, Gender, type WxCallbackHeaders } from '@tizhice/shared';
import { AssessmentService } from '../assessment/assessment.service';
import { InMemoryAssessmentRepository } from '../assessment/in-memory-assessment.repository';
import { defaultQuestionBank } from '../assessment/question-bank.fixtures';
import { ConstitutionAlgoService } from '../constitution/constitution-algo.service';
import {
  buildAlgorithmConfig,
  buildAnswersForScores,
} from '../constitution/constitution-test-fixtures';
import { InMemoryAlgorithmConfigRepository } from '../constitution/in-memory-algorithm-config.repository';
import { ConfigVersionService } from '../infrastructure/config-version/config-version.service';
import { InMemoryConfigVersionRepository } from '../infrastructure/config-version/in-memory-config-version.repository';
import { InMemoryReportRepository } from '../report/in-memory-report.repository';
import { defaultReportTemplatePayload } from '../report/report.fixtures';
import { ReportService } from '../report/report.service';
import { InMemoryPaymentRepository } from './in-memory-payment.repository';
import { PaymentService } from './payment.service';
import { DeterministicWechatPayGateway } from './wechat-pay.gateway';

export async function createPaymentFixture(options: { pendingTtlMs?: number } = {}) {
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  const algorithmConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
  await configService.publish(
    ConfigKind.QUESTION_BANK,
    defaultQuestionBank(algorithmConfig),
    'seed',
  );
  await configService.publish(ConfigKind.ALGORITHM, algorithmConfig, 'seed');
  await configService.publish(ConfigKind.REPORT_TEMPLATE, defaultReportTemplatePayload(), 'seed');
  const assessmentService = new AssessmentService({
    configService,
    algorithmService: new ConstitutionAlgoService(
      new InMemoryAlgorithmConfigRepository([algorithmConfig]),
    ),
    repository: new InMemoryAssessmentRepository(),
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
    pendingTtlMs: options.pendingTtlMs,
  });

  async function createReport(userId = 'pay-user') {
    const { sessionId } = await assessmentService.createSession({
      userId,
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
    });
    const answers = buildAnswersForScores(algorithmConfig, {
      PINGHE: [1, 1],
      QIXU: [5, 5],
    });
    for (const answer of answers) {
      await assessmentService.submitAnswer({
        sessionId,
        questionId: answer.questionId,
        value: answer.score,
      });
    }
    const finalized = await assessmentService.finalize(sessionId);
    return reportService.assemble({ sessionId, resultId: finalized.resultId });
  }

  return { paymentService, paymentRepository, reportService, reportRepository, createReport };
}

export function validCallback(orderId: string, nonce = `nonce-callback-${orderId}`) {
  const rawBody = Buffer.from(JSON.stringify({ orderId, transactionId: `wx-${orderId}` }));
  const headers: WxCallbackHeaders = {
    'wechatpay-timestamp': String(Math.floor(Date.now() / 1000)),
    'wechatpay-nonce': nonce,
    'wechatpay-signature': 'valid-signature',
    'wechatpay-serial': 'serial-test',
  };
  return { rawBody, headers };
}

export function invalidCallback(orderId: string) {
  const { rawBody, headers } = validCallback(orderId, `bad-nonce-${orderId}`);
  return {
    rawBody,
    headers: {
      ...headers,
      'wechatpay-signature': 'invalid-signature',
    },
  };
}

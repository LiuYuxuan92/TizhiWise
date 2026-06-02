import { AssessmentChannel, ConfigKind, Gender } from '@tizhice/shared';
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
import {
  anonymousUserIdFor,
  InMemoryPaymentRepository,
} from '../payment/in-memory-payment.repository';
import { PaymentService } from '../payment/payment.service';
import { DeterministicWechatPayGateway } from '../payment/wechat-pay.gateway';
import { InMemoryReportRepository } from '../report/in-memory-report.repository';
import { defaultReportTemplatePayload } from '../report/report.fixtures';
import { ReportService } from '../report/report.service';
import { InMemoryUserRepository } from './in-memory-user.repository';
import { DeterministicWechatIdentityProvider, UserService } from './user.service';

export async function createUserFixture() {
  const configService = new ConfigVersionService(new InMemoryConfigVersionRepository());
  const algorithmConfig = buildAlgorithmConfig({ version: 'v1', itemsPerType: 2 });
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
  const userRepository = new InMemoryUserRepository();
  const userService = new UserService({
    users: userRepository,
    assessmentRepository,
    reportRepository,
    paymentRepository,
    reportService,
    wechat: new DeterministicWechatIdentityProvider(),
  });

  async function createAnonymousBundle(anonymousId: string) {
    const { sessionId } = await assessmentService.createSession({
      anonymousId,
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
    const report = await reportService.assemble({ sessionId, resultId: finalized.resultId });
    await paymentService.createOrder({
      userId: anonymousUserIdFor(anonymousId),
      reportId: report.id,
      idempotencyKey: `anonymous-${anonymousId}`,
    });
    return { sessionId, reportId: report.id };
  }

  return {
    userService,
    userRepository,
    assessmentRepository,
    reportRepository,
    paymentRepository,
    assessmentService,
    reportService,
    paymentService,
    createAnonymousBundle,
  };
}

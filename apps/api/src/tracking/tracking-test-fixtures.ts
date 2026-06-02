import { AssessmentChannel, ConfigKind, ConsentScope, Gender } from '@tizhice/shared';
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
import { InMemoryPaymentRepository } from '../payment/in-memory-payment.repository';
import { InMemoryUserRepository } from '../user/in-memory-user.repository';
import { DeterministicWechatIdentityProvider, UserService } from '../user/user.service';
import { InMemoryReportRepository } from '../report/in-memory-report.repository';
import { ReportService } from '../report/report.service';
import { defaultReportTemplatePayload } from '../report/report.fixtures';
import { InMemoryTrackingRepository } from './in-memory-tracking.repository';
import { TrackingService } from './tracking.service';

export async function createTrackingFixture(options: { minAggregateCellSize?: number } = {}) {
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
  const users = new InMemoryUserRepository();
  const reportRepository = new InMemoryReportRepository();
  const reportService = new ReportService({
    configService,
    assessmentService,
    repository: reportRepository,
  });
  const paymentRepository = new InMemoryPaymentRepository();
  const userService = new UserService({
    users,
    assessmentRepository,
    reportRepository,
    paymentRepository,
    reportService,
    wechat: new DeterministicWechatIdentityProvider(),
  });
  const trackingRepository = new InMemoryTrackingRepository();
  const trackingService = new TrackingService({
    repository: trackingRepository,
    users,
    assessmentRepository,
    paymentRepository,
    minAggregateCellSize: options.minAggregateCellSize,
  });

  async function createUserWithTracking(code: string) {
    const login = await userService.wechatLogin(code);
    await userService.updateConsent(login.userId, [
      ConsentScope.BASIC,
      ConsentScope.HEALTH_DATA,
      ConsentScope.BEHAVIOR_TRACKING,
    ]);
    return login.userId;
  }

  async function finalizeConstitution(userId: string) {
    const { sessionId } = await assessmentService.createSession({
      userId,
      channel: AssessmentChannel.CONSTITUTION,
      baseProfile: { gender: Gender.F, ageBand: '26-35' },
    });
    for (const answer of buildAnswersForScores(algorithmConfig, {
      PINGHE: [1, 1],
      QIXU: [5, 5],
    })) {
      await assessmentService.submitAnswer({
        sessionId,
        questionId: answer.questionId,
        value: answer.score,
      });
    }
    return assessmentService.finalize(sessionId);
  }

  return {
    trackingService,
    trackingRepository,
    userService,
    users,
    assessmentService,
    assessmentRepository,
    createUserWithTracking,
    finalizeConstitution,
  };
}

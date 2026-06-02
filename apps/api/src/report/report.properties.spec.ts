import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AssessmentChannel, ConfigKind, Gender, ReportTier } from '@tizhice/shared';
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
import { InMemoryReportRepository } from './in-memory-report.repository';
import { defaultReportTemplatePayload } from './report.fixtures';
import { ReportService } from './report.service';

describe('ReportService properties', () => {
  it('Property 14: deep content visibility is consistent with paid access grants and revocation', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.boolean(), async (grant, revoke) => {
        const { reportService, assessmentService, algorithmConfig } = await createServices();
        const { sessionId } = await assessmentService.createSession({
          userId: 'p14-user',
          channel: AssessmentChannel.CONSTITUTION,
          baseProfile: { gender: Gender.M, ageBand: '26-35' },
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
        const report = await reportService.assemble({
          sessionId,
          resultId: finalized.resultId,
        });

        if (grant) {
          await reportService.grantDeepAccess(report.id, 'p14-user', 'order-p14');
        }
        if (grant && revoke) {
          await reportService.revokeDeepAccess(report.id, 'p14-user');
        }

        const visible = await reportService.getReport(report.id, 'p14-user');
        const shouldSeeDeep = grant && !revoke;
        expect(visible.tier).toBe(shouldSeeDeep ? ReportTier.DEEP : ReportTier.BASIC);
        expect(visible.payload.deep?.masked).toBe(!shouldSeeDeep);
        expect(Boolean(visible.payload.deep?.full)).toBe(shouldSeeDeep);
      }),
      { numRuns: 12 },
    );
  });
});

async function createServices() {
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
  const reportService = new ReportService({
    configService,
    assessmentService,
    repository: new InMemoryReportRepository(),
  });
  return { reportService, assessmentService, algorithmConfig };
}

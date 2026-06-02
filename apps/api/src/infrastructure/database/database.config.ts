import type { DataSourceOptions } from 'typeorm';
import { ConfigVersionEntity } from '../config-version/config-version.entity';
import {
  AnswerEntity,
  AssessmentSessionEntity,
  ConstitutionResultEntity,
  PainResultEntity,
} from '../../assessment/assessment.entities';
import {
  ReportDeepAccessEntity,
  ReportEntity,
  ReportExportJobEntity,
  ReportShareLinkEntity,
} from '../../report/report.entities';
import { PaymentOrderEntity, PaymentTxnLogEntity } from '../../payment/payment.entities';
import { ConsentEntity, UserEntity } from '../../user/user.entities';

export function createTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [
      ConfigVersionEntity,
      AssessmentSessionEntity,
      AnswerEntity,
      ConstitutionResultEntity,
      PainResultEntity,
      ReportEntity,
      ReportDeepAccessEntity,
      ReportShareLinkEntity,
      ReportExportJobEntity,
      PaymentOrderEntity,
      PaymentTxnLogEntity,
      UserEntity,
      ConsentEntity,
    ],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

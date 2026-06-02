import type { DataSourceOptions } from 'typeorm';
import { ConfigVersionEntity } from '../config-version/config-version.entity';
import {
  AnswerEntity,
  AssessmentSessionEntity,
  ConstitutionResultEntity,
  PainResultEntity,
} from '../../assessment/assessment.entities';

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
    ],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

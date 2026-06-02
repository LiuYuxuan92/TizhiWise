import type { DataSourceOptions } from 'typeorm';
import { ConfigVersionEntity } from '../config-version/config-version.entity';

export function createTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [ConfigVersionEntity],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

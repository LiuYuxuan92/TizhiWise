import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { createTypeOrmOptions } from './database.config';

config({ path: '.env' });
config({ path: '../../.env' });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tizhice';

export default new DataSource(createTypeOrmOptions(databaseUrl));

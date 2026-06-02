import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

export async function startPostgresTestContainer(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer('postgres:16-alpine').withDatabase('tizhice_test').start();
}

export async function startRedisTestContainer(): Promise<StartedRedisContainer> {
  return new RedisContainer('redis:7-alpine').start();
}

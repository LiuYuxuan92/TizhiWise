import type { RedisOptions } from 'ioredis';

export function createRedisConnectionOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const databaseFromPath = url.pathname.replace(/^\//, '');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: databaseFromPath ? Number(databaseFromPath) : 0,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  };
}

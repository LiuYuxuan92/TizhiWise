import { describe, expect, it } from 'vitest';
import { createBullMqOptions } from './queue.config';
import { createRedisConnectionOptions } from '../redis/redis.config';

describe('infrastructure config factories', () => {
  it('creates Redis and BullMQ options from REDIS_URL', () => {
    const redis = createRedisConnectionOptions('redis://:pass@localhost:6380/2');
    expect(redis).toMatchObject({ host: 'localhost', port: 6380, password: 'pass', db: 2 });

    const bull = createBullMqOptions('redis://localhost:6379');
    expect(bull.connection).toMatchObject({ host: 'localhost', port: 6379 });
  });
});

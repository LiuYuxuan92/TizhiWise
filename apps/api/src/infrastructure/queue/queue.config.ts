import type { QueueOptions } from 'bullmq';
import { createRedisConnectionOptions } from '../redis/redis.config';

export function createBullMqOptions(redisUrl: string): QueueOptions {
  return {
    connection: createRedisConnectionOptions(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  };
}

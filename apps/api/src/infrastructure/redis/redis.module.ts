import Redis from 'ioredis';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRedisConnectionOptions } from './redis.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        return new Redis(createRedisConnectionOptions(redisUrl));
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisInfrastructureModule {}

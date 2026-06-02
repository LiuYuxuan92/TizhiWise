import { Queue } from 'bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createBullMqOptions } from './queue.config';

export const REPORT_QUEUE = Symbol('REPORT_QUEUE');
export const AI_CONTENT_QUEUE = Symbol('AI_CONTENT_QUEUE');
export const PAYMENT_CALLBACK_QUEUE = Symbol('PAYMENT_CALLBACK_QUEUE');

@Global()
@Module({
  providers: [
    {
      provide: REPORT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Queue =>
        new Queue(
          'report-rendering',
          createBullMqOptions(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        ),
    },
    {
      provide: AI_CONTENT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Queue =>
        new Queue(
          'ai-content-generation',
          createBullMqOptions(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        ),
    },
    {
      provide: PAYMENT_CALLBACK_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Queue =>
        new Queue(
          'payment-callback-replay',
          createBullMqOptions(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        ),
    },
  ],
  exports: [REPORT_QUEUE, AI_CONTENT_QUEUE, PAYMENT_CALLBACK_QUEUE],
})
export class QueueInfrastructureModule {}

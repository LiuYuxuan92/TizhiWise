import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { InjectionGuardPipe } from './injection-guard.pipe';
import { RateLimitGuard } from './rate-limit.guard';
import { SafeLoggerService } from './safe-logger.service';
import { TraceIdMiddleware } from './trace-id.middleware';

@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_PIPE, useClass: InjectionGuardPipe },
    SafeLoggerService,
  ],
  exports: [SafeLoggerService],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}

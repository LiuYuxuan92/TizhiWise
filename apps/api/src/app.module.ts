import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { GatewayModule } from './infrastructure/gateway/gateway.module';
import { QueueInfrastructureModule } from './infrastructure/queue/queue.module';
import { RedisInfrastructureModule } from './infrastructure/redis/redis.module';

@Module({
  imports: [
    // 全局加载 .env（根目录与应用目录），约定见 .env.example
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      cache: true,
    }),
    DatabaseModule,
    GatewayModule,
    CryptoModule,
    RedisInfrastructureModule,
    QueueInfrastructureModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}

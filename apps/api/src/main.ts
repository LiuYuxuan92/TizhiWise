import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3000);
  const globalPrefix = config.get<string>('API_GLOBAL_PREFIX', 'api');

  app.setGlobalPrefix(globalPrefix);

  // 对所有外部输入进行统一校验（R12.2）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException(
          errors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
          })),
        ),
    }),
  );

  await app.listen(port);
  Logger.log(`知体 API 已启动: http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
}

void bootstrap();

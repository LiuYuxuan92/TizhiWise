import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigVersionEntity } from '../config-version/config-version.entity';
import { createTypeOrmOptions } from './database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createTypeOrmOptions(
          config.get<string>(
            'DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/tizhice',
          ),
        ),
    }),
    TypeOrmModule.forFeature([ConfigVersionEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

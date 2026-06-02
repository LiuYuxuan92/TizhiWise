import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BufferKmsKeyProvider, EncryptionService } from './encryption.service';

export const APP_ENCRYPTION = Symbol('APP_ENCRYPTION');

@Global()
@Module({
  providers: [
    {
      provide: APP_ENCRYPTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EncryptionService => {
        const rawKey = config.get<string>('APP_ENCRYPTION_KEY');
        if (!rawKey || rawKey === 'base64-placeholder-do-not-use-in-prod') {
          if (config.get<string>('NODE_ENV', 'development') === 'production') {
            throw new Error('APP_ENCRYPTION_KEY must be configured in production');
          }
          return new EncryptionService(
            new BufferKmsKeyProvider([{ id: 'dev-local', key: Buffer.alloc(32, 0) }]),
          );
        }
        return new EncryptionService(
          new BufferKmsKeyProvider([{ id: 'env', key: Buffer.from(rawKey, 'base64') }]),
        );
      },
    },
  ],
  exports: [APP_ENCRYPTION],
})
export class CryptoModule {}

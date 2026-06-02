import { Column, type ColumnOptions } from 'typeorm';
import { EncryptedJsonTransformer, type EncryptionService } from './encryption.service';

export function createEncryptedJsonColumnOptions(
  encryption: EncryptionService,
  options: Omit<ColumnOptions, 'type' | 'transformer'> = {},
): ColumnOptions {
  return {
    ...options,
    type: 'text',
    transformer: new EncryptedJsonTransformer(encryption),
  };
}

export function EncryptedJsonColumn(
  encryption: EncryptionService,
  options: Omit<ColumnOptions, 'type' | 'transformer'> = {},
): PropertyDecorator {
  return Column(createEncryptedJsonColumnOptions(encryption, options));
}

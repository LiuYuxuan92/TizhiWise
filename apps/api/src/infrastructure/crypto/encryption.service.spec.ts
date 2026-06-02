import { describe, expect, it } from 'vitest';
import {
  BufferKmsKeyProvider,
  EncryptionService,
  EncryptedJsonTransformer,
} from './encryption.service';
import { createEncryptedJsonColumnOptions } from './encrypted-json.column';

describe('EncryptionService', () => {
  it('round-trips JSON values without leaking plaintext', () => {
    const key = Buffer.alloc(32, 7);
    const service = new EncryptionService(new BufferKmsKeyProvider([{ id: 'k1', key }]));
    const input = { ageBand: '26-35', symptom: 'neck pain', nested: { score: 4 } };

    const sealed = service.encryptJson(input);
    expect(sealed).toContain('k1:');
    expect(sealed).not.toContain('neck pain');

    expect(service.decryptJson<typeof input>(sealed)).toEqual(input);
  });

  it('decrypts old payloads after key rotation when previous keys are retained', () => {
    const oldKey = Buffer.alloc(32, 1);
    const newKey = Buffer.alloc(32, 2);
    const oldService = new EncryptionService(
      new BufferKmsKeyProvider([{ id: 'old', key: oldKey }]),
    );
    const sealedWithOldKey = oldService.encryptJson({ report: 'historical' });

    const rotatedService = new EncryptionService(
      new BufferKmsKeyProvider([
        { id: 'new', key: newKey },
        { id: 'old', key: oldKey },
      ]),
    );

    expect(rotatedService.decryptJson(sealedWithOldKey)).toEqual({ report: 'historical' });
  });

  it('rejects ciphertext encrypted with a different key', () => {
    const service = new EncryptionService(
      new BufferKmsKeyProvider([{ id: 'k1', key: Buffer.alloc(32, 3) }]),
    );
    const wrongKeyService = new EncryptionService(
      new BufferKmsKeyProvider([{ id: 'k1', key: Buffer.alloc(32, 4) }]),
    );
    const sealed = service.encryptJson({ health: 'sensitive' });

    expect(() => wrongKeyService.decryptJson(sealed)).toThrow(/decrypt/i);
  });

  it('provides a TypeORM-compatible value transformer for transparent encrypted fields', () => {
    const transformer = new EncryptedJsonTransformer(
      new EncryptionService(new BufferKmsKeyProvider([{ id: 'k1', key: Buffer.alloc(32, 5) }])),
    );

    const databaseValue = transformer.to({ answer: 5 });
    expect(typeof databaseValue).toBe('string');
    expect(databaseValue).not.toContain('answer');
    expect(transformer.from(databaseValue)).toEqual({ answer: 5 });
  });

  it('provides reusable encrypted JSON column options for entities', () => {
    const encryption = new EncryptionService(
      new BufferKmsKeyProvider([{ id: 'k1', key: Buffer.alloc(32, 6) }]),
    );
    const options = createEncryptedJsonColumnOptions(encryption, { nullable: true });

    expect(options.type).toBe('text');
    expect(options.nullable).toBe(true);
    expect(options.transformer).toBeInstanceOf(EncryptedJsonTransformer);
  });
});

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const PAYLOAD_VERSION = 'v1';

export interface KmsKeyMaterial {
  id: string;
  key: Buffer;
}

export interface KmsKeyProvider {
  getActiveKey(): KmsKeyMaterial;
  getKey(keyId: string): KmsKeyMaterial | undefined;
}

export class BufferKmsKeyProvider implements KmsKeyProvider {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly activeKeyId: string;

  constructor(keys: readonly KmsKeyMaterial[]) {
    if (keys.length === 0) {
      throw new Error('At least one encryption key is required');
    }

    const entries = keys.map(({ id, key }) => {
      validateAes256Key(key, id);
      return [id, Buffer.from(key)] as const;
    });
    this.keys = new Map(entries);
    this.activeKeyId = keys[0]!.id;
  }

  getActiveKey(): KmsKeyMaterial {
    return this.materialFor(this.activeKeyId);
  }

  getKey(keyId: string): KmsKeyMaterial | undefined {
    const key = this.keys.get(keyId);
    return key ? { id: keyId, key: Buffer.from(key) } : undefined;
  }

  private materialFor(keyId: string): KmsKeyMaterial {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Unknown encryption key id: ${keyId}`);
    }
    return { id: keyId, key: Buffer.from(key) };
  }
}

export class EnvironmentKmsKeyProvider extends BufferKmsKeyProvider {
  constructor(rawBase64Key: string, keyId = 'env') {
    super([{ id: keyId, key: Buffer.from(rawBase64Key, 'base64') }]);
  }
}

export class EncryptionService {
  constructor(private readonly keyProvider: KmsKeyProvider) {}

  encryptJson(value: unknown): string {
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const { id: keyId, key } = this.keyProvider.getActiveKey();
    validateAes256Key(key, keyId);

    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      PAYLOAD_VERSION,
      keyId,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decryptJson<T = unknown>(sealed: string): T {
    const [version, keyId, ivPart, authTagPart, ciphertextPart] = sealed.split(':');
    if (version !== PAYLOAD_VERSION || !keyId || !ivPart || !authTagPart || !ciphertextPart) {
      throw new Error('Invalid encrypted payload format');
    }

    const material = this.keyProvider.getKey(keyId);
    if (!material) {
      throw new Error(`Cannot decrypt payload: key ${keyId} is unavailable`);
    }
    validateAes256Key(material.key, keyId);

    try {
      const decipher = createDecipheriv(ALGORITHM, material.key, Buffer.from(ivPart, 'base64url'), {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });
      decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as T;
    } catch (error) {
      throw new Error(`Cannot decrypt payload: ${(error as Error).message}`);
    }
  }
}

export class EncryptedJsonTransformer implements ValueTransformer {
  constructor(private readonly encryption: EncryptionService) {}

  to(entityValue: unknown): string | null {
    if (entityValue === null || entityValue === undefined) {
      return null;
    }
    return this.encryption.encryptJson(entityValue);
  }

  from(databaseValue: string | null): unknown {
    if (databaseValue === null || databaseValue === undefined) {
      return null;
    }
    return this.encryption.decryptJson(databaseValue);
  }
}

function validateAes256Key(key: Buffer, keyId: string): void {
  if (key.length !== 32) {
    throw new Error(`Encryption key ${keyId} must be exactly 32 bytes for AES-256-GCM`);
  }
}

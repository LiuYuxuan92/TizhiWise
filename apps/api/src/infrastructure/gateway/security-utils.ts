import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface ApiErrorResponse {
  code: string;
  message: string;
  traceId: string;
  retriable: boolean;
}

export function buildApiErrorResponse(input: {
  code: string;
  message: string;
  traceId?: string;
  retriable?: boolean;
}): ApiErrorResponse {
  return {
    code: input.code,
    message: sanitizeExternalMessage(input.message),
    traceId: input.traceId ?? 'unknown-trace',
    retriable: input.retriable ?? false,
  };
}

export function sanitizeExternalMessage(message: string): string {
  return message.replace(
    /(openid|unionid|token|authorization|password|secret|api[_-]?key)=?[^\s,;]*/gi,
    '$1=[REDACTED]',
  );
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        isSensitiveKey(key) ? '[REDACTED]' : redactSensitive(child),
      ]),
    );
  }
  if (typeof value === 'string') return sanitizeExternalMessage(value);
  return value;
}

export function signJwtLike(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwtLike<T extends Record<string, unknown>>(token: string, secret: string): T {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) throw new Error('Invalid token');
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (!safeEqual(signature, expected)) throw new Error('Invalid token');
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & {
    exp?: number;
  };
  if (typeof parsed.exp === 'number' && parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return parsed;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now = Date.now()): { allowed: boolean; remaining: number; resetAt: number } {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }
    if (current.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }
    current.count += 1;
    return { allowed: true, remaining: this.limit - current.count, resetAt: current.resetAt };
  }
}

export async function retryWithFallback<T>(input: {
  operation: () => Promise<T>;
  fallback: () => Promise<T> | T;
  retries: number;
  shouldRetry?: (error: unknown) => boolean;
}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= input.retries; attempt += 1) {
    try {
      return await input.operation();
    } catch (error) {
      lastError = error;
      if (input.shouldRetry && !input.shouldRetry(error)) break;
    }
  }
  const fallback = await input.fallback();
  if (fallback === undefined)
    throw lastError instanceof Error ? lastError : new Error('Operation failed');
  return fallback;
}

export function ensureNoSqlMetaCharacters(input: unknown): void {
  const serialized = JSON.stringify(input ?? '');
  if (/;\s*(drop|delete|truncate|alter)\b/i.test(serialized) || /--\s*$/.test(serialized)) {
    throw new Error('Potential injection payload rejected');
  }
}

export function traceIdFrom(input?: string): string {
  if (input && /^[a-zA-Z0-9._:-]{8,128}$/.test(input)) return input;
  return `trc_${createHash('sha1').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 24)}`;
}

function isSensitiveKey(key: string): boolean {
  return /openid|unionid|token|authorization|password|secret|api[_-]?key|raw[_-]?callback|health|answer/i.test(
    key,
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

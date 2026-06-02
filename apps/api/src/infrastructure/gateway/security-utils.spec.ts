import { describe, expect, it } from 'vitest';
import {
  buildApiErrorResponse,
  ensureNoSqlMetaCharacters,
  InMemoryRateLimiter,
  redactSensitive,
  retryWithFallback,
  signJwtLike,
  traceIdFrom,
  verifyJwtLike,
} from './security-utils';

describe('gateway security utilities', () => {
  it('returns unified API error response without leaking sensitive tokens', () => {
    expect(
      buildApiErrorResponse({
        code: 'BAD_REQUEST',
        message: 'token=abc openid=o123 validation failed',
        traceId: 'trace-1234',
      }),
    ).toEqual({
      code: 'BAD_REQUEST',
      message: 'token=[REDACTED] openid=[REDACTED] validation failed',
      traceId: 'trace-1234',
      retriable: false,
    });
  });

  it('redacts nested sensitive log fields', () => {
    expect(
      redactSensitive({
        openid: 'wx-openid',
        nested: { password: 'secret', answerValue: 'health answer', safe: 'ok' },
      }),
    ).toEqual({
      openid: '[REDACTED]',
      nested: { password: '[REDACTED]', answerValue: '[REDACTED]', safe: 'ok' },
    });
  });

  it('signs and verifies JWT-like tokens and rejects tampering', () => {
    const token = signJwtLike({ sub: 'user-1', permissions: ['A'] }, 'secret');
    expect(verifyJwtLike<{ sub: string }>(token, 'secret')).toMatchObject({ sub: 'user-1' });
    expect(() => verifyJwtLike(`${token}x`, 'secret')).toThrow(/Invalid token/);
  });

  it('applies in-memory rate limiting per key', () => {
    const limiter = new InMemoryRateLimiter(2, 1000);
    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip').allowed).toBe(false);
    expect(limiter.consume('ip', Date.now() + 1001).allowed).toBe(true);
  });

  it('rejects obvious destructive SQL metacharacter payloads', () => {
    expect(() => ensureNoSqlMetaCharacters({ q: 'normal keyword' })).not.toThrow();
    expect(() => ensureNoSqlMetaCharacters({ q: 'abc; DROP TABLE users' })).toThrow(/injection/);
  });

  it('retries transient failures and returns fallback after cap', async () => {
    let calls = 0;
    await expect(
      retryWithFallback({
        operation: async () => {
          calls += 1;
          throw new Error('transient');
        },
        fallback: () => 'fallback',
        retries: 2,
      }),
    ).resolves.toBe('fallback');
    expect(calls).toBe(3);
  });

  it('keeps valid incoming traceId and creates safe fallback ids', () => {
    expect(traceIdFrom('trace-abc-1234')).toBe('trace-abc-1234');
    expect(traceIdFrom('bad trace id')).toMatch(/^trc_/);
  });
});

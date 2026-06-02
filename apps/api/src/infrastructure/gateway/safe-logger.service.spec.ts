import { describe, expect, it } from 'vitest';
import { SafeLoggerService } from './safe-logger.service';

describe('SafeLoggerService', () => {
  it('sanitizes structured logs before writing sensitive runtime state', () => {
    const logger = new SafeLoggerService();
    expect(
      logger.sanitize({
        traceId: 'trace-1',
        event: 'payment_callback',
        payload: {
          rawCallback: 'ciphertext',
          openid: 'wx-openid',
          nested: { apiKey: 'key', amount: 1990 },
        },
      }),
    ).toEqual({
      traceId: 'trace-1',
      event: 'payment_callback',
      payload: {
        rawCallback: '[REDACTED]',
        openid: '[REDACTED]',
        nested: { apiKey: '[REDACTED]', amount: 1990 },
      },
    });
  });
});

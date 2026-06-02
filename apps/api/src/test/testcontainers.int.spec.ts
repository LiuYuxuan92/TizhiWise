import { describe, expect, it } from 'vitest';
import { startPostgresTestContainer, startRedisTestContainer } from './testcontainers';

describe('Testcontainers integration test base', () => {
  it('exports PostgreSQL and Redis container starters for integration tests', () => {
    expect(typeof startPostgresTestContainer).toBe('function');
    expect(typeof startRedisTestContainer).toBe('function');
  });
});

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createUserFixture } from './user-test-fixtures';

describe('UserService properties', () => {
  it('Property 27: anonymous merge is idempotent and preserves records', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (repeatCount) => {
        const { userService, createAnonymousBundle } = await createUserFixture();
        await createAnonymousBundle('p27-anon');
        const login = await userService.wechatLogin('p27');

        let last = { mergedSessions: 0, mergedReports: 0, mergedOrders: 0 };
        for (let index = 0; index < repeatCount; index += 1) {
          last = await userService.mergeAnonymous({
            userId: login.userId,
            anonymousId: 'p27-anon',
          });
        }
        const my = await userService.getMyCenter(login.userId);

        expect(my.sessions).toHaveLength(1);
        expect(my.reports).toHaveLength(1);
        expect(my.orders).toHaveLength(1);
        expect(last.mergedSessions).toBe(repeatCount === 1 ? 1 : 0);
      }),
      { numRuns: 12 },
    );
  });

  it('Property 29: after deletion user identifiers are no longer personally identifiable', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 16 }), async (codeSuffix) => {
        const { userService } = await createUserFixture();
        const login = await userService.wechatLogin(`p29-${codeSuffix}`);

        await userService.requestDeletion(login.userId);
        const deleted = await userService.getUser(login.userId);

        expect(deleted.deletedAt).toBeInstanceOf(Date);
        expect(deleted.wxOpenId).not.toContain(`p29-${codeSuffix}`);
        expect(deleted.wxUnionId).not.toContain(`p29-${codeSuffix}`);
        expect(deleted.nickname).toBeUndefined();
        expect(deleted.consentScopes).toEqual([]);
      }),
      { numRuns: 12 },
    );
  });
});

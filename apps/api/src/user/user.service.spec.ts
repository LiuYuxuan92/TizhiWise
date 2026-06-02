import { describe, expect, it } from 'vitest';
import { ConsentScope } from '@tizhice/shared';
import { createUserFixture } from './user-test-fixtures';
import { DeletedUserAccessError } from './user.service';

describe('UserService', () => {
  it('creates and reuses a WeChat user with server-issued token', async () => {
    const { userService } = await createUserFixture();

    const first = await userService.wechatLogin('code-a');
    const second = await userService.wechatLogin('code-a');

    expect(first).toMatchObject({ isNew: true });
    expect(second).toMatchObject({ isNew: false, userId: first.userId });
    expect(Buffer.from(first.token, 'base64url').toString('utf8')).toContain(first.userId);
  });

  it('updates consent scopes and records consent history', async () => {
    const { userService, userRepository } = await createUserFixture();
    const login = await userService.wechatLogin('consent');

    await userService.updateConsent(login.userId, [ConsentScope.BASIC]);

    await expect(userService.getUser(login.userId)).resolves.toMatchObject({
      consentScopes: [ConsentScope.BASIC],
    });
    expect(await userRepository.listConsentHistory(login.userId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: ConsentScope.HEALTH_DATA, revokedAt: expect.any(Date) }),
      ]),
    );
  });

  it('merges anonymous sessions, reports and orders into the logged-in user', async () => {
    const { userService, createAnonymousBundle } = await createUserFixture();
    await createAnonymousBundle('anon-merge');
    const login = await userService.wechatLogin('merge');

    const merged = await userService.mergeAnonymous({
      userId: login.userId,
      anonymousId: 'anon-merge',
    });
    const my = await userService.getMyCenter(login.userId);

    expect(merged).toEqual({ mergedSessions: 1, mergedReports: 1, mergedOrders: 1 });
    expect(my.sessions).toHaveLength(1);
    expect(my.reports).toHaveLength(1);
    expect(my.orders).toHaveLength(1);
    expect(my.sessions[0]?.anonymousId).toBeNull();
  });

  it('anonymizes identifiable user data and blocks access after deletion', async () => {
    const { userService, createAnonymousBundle } = await createUserFixture();
    await createAnonymousBundle('anon-delete');
    const login = await userService.wechatLogin('delete');
    await userService.mergeAnonymous({ userId: login.userId, anonymousId: 'anon-delete' });

    const deletion = await userService.requestDeletion(login.userId);
    const deleted = await userService.getUser(login.userId);

    expect(deletion.scheduledAt).toBeInstanceOf(Date);
    expect(deleted.wxOpenId).not.toContain('wx-openid');
    expect(deleted.wxUnionId).not.toContain('wx-unionid');
    expect(deleted.nickname).toBeUndefined();
    expect(deleted.consentScopes).toEqual([]);
    await expect(userService.getMyCenter(login.userId)).rejects.toBeInstanceOf(
      DeletedUserAccessError,
    );
  });
});

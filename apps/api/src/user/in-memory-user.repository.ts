import { ConsentScope, type Consent, type User } from '@tizhice/shared';

export interface WechatIdentity {
  openId: string;
  unionId?: string;
  nickname?: string;
}

export class InMemoryUserRepository {
  private userCounter = 0;
  private readonly users = new Map<string, User>();
  private readonly usersByOpenId = new Map<string, string>();
  private readonly consentHistory: Consent[] = [];

  nextUserId(): string {
    this.userCounter += 1;
    return `user-${this.userCounter}`;
  }

  async findByOpenId(openId: string): Promise<User | null> {
    const id = this.usersByOpenId.get(openId);
    if (!id) {
      return null;
    }
    const user = this.users.get(id);
    return user ? cloneUser(user) : null;
  }

  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, cloneUser(user));
    this.usersByOpenId.set(user.wxOpenId, user.id);
  }

  async getUserOrThrow(userId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return cloneUser(user);
  }

  async updateConsent(userId: string, scopes: readonly ConsentScope[]): Promise<void> {
    const user = await this.getUserOrThrow(userId);
    const now = new Date();
    const nextScopes = [...new Set(scopes)];
    for (const oldScope of user.consentScopes) {
      if (!nextScopes.includes(oldScope)) {
        this.consentHistory.push({
          userId,
          scope: oldScope,
          grantedAt: user.createdAt,
          revokedAt: now,
        });
      }
    }
    for (const newScope of nextScopes) {
      if (!user.consentScopes.includes(newScope)) {
        this.consentHistory.push({ userId, scope: newScope, grantedAt: now });
      }
    }
    await this.saveUser({ ...user, consentScopes: nextScopes });
  }

  async anonymizeUser(userId: string): Promise<User> {
    const user = await this.getUserOrThrow(userId);
    const anonymized: User = {
      ...user,
      wxOpenId: anonymizedIdentifier(userId, 'openid'),
      wxUnionId: anonymizedIdentifier(userId, 'unionid'),
      nickname: undefined,
      consentScopes: [],
      deletedAt: new Date(),
    };
    this.usersByOpenId.delete(user.wxOpenId);
    await this.saveUser(anonymized);
    return cloneUser(anonymized);
  }

  async listConsentHistory(userId: string): Promise<Consent[]> {
    return this.consentHistory
      .filter((consent) => consent.userId === userId)
      .map((consent) => ({
        ...consent,
        grantedAt: new Date(consent.grantedAt),
        revokedAt: consent.revokedAt ? new Date(consent.revokedAt) : undefined,
      }));
  }
}

export function defaultConsentScopes(): ConsentScope[] {
  return [ConsentScope.BASIC, ConsentScope.HEALTH_DATA];
}

export function anonymizedIdentifier(userId: string, field: string): string {
  return `anon-${field}-${userId}`;
}

function cloneUser(user: User): User {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    deletedAt: user.deletedAt ? new Date(user.deletedAt) : undefined,
    consentScopes: [...user.consentScopes],
  };
}

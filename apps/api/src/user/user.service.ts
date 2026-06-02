import {
  ConsentScope,
  type DeletionResult,
  type MergeAnonymousInput,
  type MergeAnonymousResult,
  type MyCenterResult,
  type User,
  type WechatLoginResult,
} from '@tizhice/shared';
import type { InMemoryAssessmentRepository } from '../assessment/in-memory-assessment.repository';
import type { InMemoryPaymentRepository } from '../payment/in-memory-payment.repository';
import type { InMemoryReportRepository } from '../report/in-memory-report.repository';
import type { ReportService } from '../report/report.service';
import {
  anonymizedIdentifier,
  defaultConsentScopes,
  InMemoryUserRepository,
  type WechatIdentity,
} from './in-memory-user.repository';

export interface WechatIdentityProvider {
  resolve(code: string): Promise<WechatIdentity>;
}

interface UserServiceDependencies {
  users: InMemoryUserRepository;
  assessmentRepository: InMemoryAssessmentRepository;
  reportRepository: InMemoryReportRepository;
  paymentRepository: InMemoryPaymentRepository;
  reportService: ReportService;
  wechat: WechatIdentityProvider;
}

export class DeterministicWechatIdentityProvider implements WechatIdentityProvider {
  async resolve(code: string): Promise<WechatIdentity> {
    if (!code.trim()) {
      throw new Error('Wechat OAuth code is required');
    }
    return {
      openId: `wx-openid-${code}`,
      unionId: `wx-unionid-${code}`,
      nickname: `微信用户-${code}`,
    };
  }
}

export class DeletedUserAccessError extends Error {
  static override readonly name = 'DeletedUserAccessError';
  override readonly name = DeletedUserAccessError.name;
}

export class UserService {
  constructor(private readonly dependencies: UserServiceDependencies) {}

  async wechatLogin(code: string): Promise<WechatLoginResult> {
    const identity = await this.dependencies.wechat.resolve(code);
    const existing = await this.dependencies.users.findByOpenId(identity.openId);
    if (existing) {
      assertNotDeleted(existing);
      return {
        userId: existing.id,
        isNew: false,
        token: signToken(existing.id),
      };
    }

    const user: User = {
      id: this.dependencies.users.nextUserId(),
      wxOpenId: identity.openId,
      wxUnionId: identity.unionId,
      nickname: identity.nickname,
      createdAt: new Date(),
      consentScopes: defaultConsentScopes(),
    };
    await this.dependencies.users.saveUser(user);
    await this.dependencies.users.updateConsent(user.id, user.consentScopes);
    return {
      userId: user.id,
      isNew: true,
      token: signToken(user.id),
    };
  }

  async mergeAnonymous(input: MergeAnonymousInput): Promise<MergeAnonymousResult> {
    const user = await this.dependencies.users.getUserOrThrow(input.userId);
    assertNotDeleted(user);
    const sessions = await this.dependencies.assessmentRepository.mergeAnonymousSessions(
      input.userId,
      input.anonymousId,
    );
    const mergedReports = await this.dependencies.reportRepository.mergeAnonymousReports(
      input.userId,
      sessions.sessionIds,
    );
    const mergedOrders = await this.dependencies.paymentRepository.mergeAnonymousOrders(
      input.userId,
      input.anonymousId,
    );

    return {
      mergedSessions: sessions.merged,
      mergedReports,
      mergedOrders,
    };
  }

  async getMyCenter(userId: string): Promise<MyCenterResult> {
    const user = await this.dependencies.users.getUserOrThrow(userId);
    assertNotDeleted(user);
    return {
      sessions: await this.dependencies.assessmentRepository.listSessionsByUser(userId),
      reports: await this.dependencies.reportService.listMyReports(userId),
      orders: await this.dependencies.paymentRepository.listOrdersByUser(userId),
    };
  }

  async updateConsent(userId: string, scopes: readonly ConsentScope[]): Promise<void> {
    const user = await this.dependencies.users.getUserOrThrow(userId);
    assertNotDeleted(user);
    await this.dependencies.users.updateConsent(userId, scopes);
  }

  async requestDeletion(userId: string): Promise<DeletionResult> {
    const user = await this.dependencies.users.anonymizeUser(userId);
    const anonymizedUserId = anonymizedIdentifier(userId, 'user');
    await this.dependencies.assessmentRepository.anonymizeUserSessions(userId, anonymizedUserId);
    await this.dependencies.reportRepository.anonymizeUserReports(userId, anonymizedUserId);
    await this.dependencies.paymentRepository.anonymizeUserOrders(userId, anonymizedUserId);
    return { scheduledAt: user.deletedAt ?? new Date() };
  }

  async getUser(userId: string): Promise<User> {
    return this.dependencies.users.getUserOrThrow(userId);
  }
}

function signToken(userId: string): string {
  return Buffer.from(JSON.stringify({ sub: userId, typ: 'access' })).toString('base64url');
}

function assertNotDeleted(user: User): void {
  if (user.deletedAt) {
    throw new DeletedUserAccessError(`User ${user.id} has been deleted`);
  }
}

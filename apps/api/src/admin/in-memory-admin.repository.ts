import type { AdminPermission, AdminRole, AdminUser, AuditLog, Question } from '@tizhice/shared';
import { deepClone } from '../infrastructure/config-version/config-version.service';

export interface StoredAdminUser extends AdminUser {
  passwordHash: string;
}

export interface AuditLogFilters {
  operator?: string;
  action?: string;
  resource?: string;
}

export class InMemoryAdminRepository {
  private auditCounter = 0;
  private readonly users = new Map<string, StoredAdminUser>();
  private readonly roles = new Map<string, AdminRole>();
  private readonly questionDrafts = new Map<string, Question>();
  private readonly auditLogs: AuditLog[] = [];

  nextAuditId(): string {
    this.auditCounter += 1;
    return `audit-${this.auditCounter}`;
  }

  async saveUser(user: StoredAdminUser): Promise<void> {
    this.users.set(user.id, cloneUser(user));
  }

  async updateUser(user: StoredAdminUser): Promise<void> {
    if (!this.users.has(user.id)) {
      throw new Error(`Admin user not found: ${user.id}`);
    }
    this.users.set(user.id, cloneUser(user));
  }

  async findUserById(id: string): Promise<StoredAdminUser | undefined> {
    const user = this.users.get(id);
    return user ? cloneUser(user) : undefined;
  }

  async findUserByUsername(username: string): Promise<StoredAdminUser | undefined> {
    const user = [...this.users.values()].find((candidate) => candidate.username === username);
    return user ? cloneUser(user) : undefined;
  }

  async saveRole(role: AdminRole): Promise<void> {
    this.roles.set(role.id, cloneRole(role));
  }

  async listRolesByIds(roleIds: readonly string[]): Promise<AdminRole[]> {
    return roleIds
      .map((roleId) => this.roles.get(roleId))
      .filter((role): role is AdminRole => Boolean(role))
      .map(cloneRole);
  }

  async saveQuestionDraft(question: Question): Promise<void> {
    this.questionDrafts.set(question.id, deepClone(question));
  }

  async deleteQuestionDraft(questionId: string): Promise<void> {
    this.questionDrafts.delete(questionId);
  }

  async getQuestionDraft(questionId: string): Promise<Question | undefined> {
    const question = this.questionDrafts.get(questionId);
    return question ? deepClone(question) : undefined;
  }

  async listQuestionDrafts(): Promise<Question[]> {
    return [...this.questionDrafts.values()].map((question) => deepClone(question));
  }

  async saveAuditLog(log: AuditLog): Promise<void> {
    this.auditLogs.push(cloneAudit(log));
  }

  async listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    return this.auditLogs
      .filter((log) => (filters.operator ? log.operator === filters.operator : true))
      .filter((log) => (filters.action ? log.action === filters.action : true))
      .filter((log) => (filters.resource ? log.resource === filters.resource : true))
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .map(cloneAudit);
  }
}

function cloneUser(user: StoredAdminUser): StoredAdminUser {
  return {
    ...user,
    roleIds: [...user.roleIds],
    createdAt: new Date(user.createdAt),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
  };
}

function cloneRole(role: AdminRole): AdminRole {
  return {
    ...role,
    permissions: [...role.permissions] as AdminPermission[],
  };
}

function cloneAudit(log: AuditLog): AuditLog {
  return {
    ...log,
    before: deepClone(log.before),
    after: deepClone(log.after),
    occurredAt: new Date(log.occurredAt),
  };
}

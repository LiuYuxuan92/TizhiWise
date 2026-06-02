import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminPermission } from '@tizhice/shared';

export const REQUIRED_PERMISSIONS_KEY = 'requiredAdminPermissions';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<AdminPermission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { permissions?: AdminPermission[] } }>();
    const permissions = request.user?.permissions ?? [];
    const allowed = required.every((permission) => permissions.includes(permission));
    if (!allowed) throw new ForbiddenException('Forbidden by RBAC');
    return true;
  }
}

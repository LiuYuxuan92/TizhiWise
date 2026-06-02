import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyJwtLike } from './security-utils';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing bearer token');
    try {
      request.user = verifyJwtLike(
        authorization.slice('Bearer '.length),
        this.config.get<string>('JWT_SECRET', 'dev-secret'),
      );
      return true;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }
}

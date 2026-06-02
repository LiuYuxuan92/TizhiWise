import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InMemoryRateLimiter } from './security-utils';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new InMemoryRateLimiter(120, 60_000);

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ ip?: string; headers: Record<string, string> }>();
    const key = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown';
    const result = this.limiter.consume(String(key));
    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}

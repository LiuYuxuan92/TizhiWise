import { Injectable, NestMiddleware } from '@nestjs/common';
import { traceIdFrom } from './security-utils';

interface MinimalRequest {
  traceId?: string;
  header(name: string): string | undefined;
}

interface MinimalResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: MinimalRequest, res: MinimalResponse, next: () => void): void {
    const incoming = req.header('x-trace-id') ?? undefined;
    const traceId = traceIdFrom(incoming);
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
  }
}

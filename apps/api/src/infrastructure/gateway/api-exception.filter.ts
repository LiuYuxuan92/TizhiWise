import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { buildApiErrorResponse } from './security-utils';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = ctx.getRequest<{ traceId?: string }>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    response.status(status).json(
      buildApiErrorResponse({
        code: exception instanceof HttpException ? `HTTP_${status}` : 'INTERNAL_ERROR',
        message: status >= 500 ? 'Internal server error' : message,
        traceId: request.traceId,
        retriable: status >= 500 || status === HttpStatus.TOO_MANY_REQUESTS,
      }),
    );
  }
}

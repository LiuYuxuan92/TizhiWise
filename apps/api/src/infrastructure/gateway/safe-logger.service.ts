import { Injectable, Logger } from '@nestjs/common';
import { redactSensitive } from './security-utils';

export interface StructuredLogEntry {
  traceId: string;
  event: string;
  payload?: unknown;
}

@Injectable()
export class SafeLoggerService {
  private readonly logger = new Logger('SafeLogger');

  info(entry: StructuredLogEntry): void {
    this.logger.log(JSON.stringify(this.sanitize(entry)));
  }

  error(entry: StructuredLogEntry): void {
    this.logger.error(JSON.stringify(this.sanitize(entry)));
  }

  sanitize(entry: StructuredLogEntry): StructuredLogEntry {
    return {
      ...entry,
      payload: redactSensitive(entry.payload),
    };
  }
}

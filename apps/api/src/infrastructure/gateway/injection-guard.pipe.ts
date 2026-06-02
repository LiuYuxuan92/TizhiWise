import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ensureNoSqlMetaCharacters } from './security-utils';

@Injectable()
export class InjectionGuardPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      ensureNoSqlMetaCharacters(value);
      return value;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid input');
    }
  }
}

import { Controller, Get } from '@nestjs/common';
import { SHARED_PACKAGE_VERSION } from '@tizhice/shared';

interface HealthStatus {
  status: 'ok';
  service: string;
  sharedVersion: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: '@tizhice/api',
      sharedVersion: SHARED_PACKAGE_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}

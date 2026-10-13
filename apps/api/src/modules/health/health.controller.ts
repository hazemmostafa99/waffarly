import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getLiveness(): { status: 'ok'; service: 'waffarly-api' } {
    return { status: 'ok', service: 'waffarly-api' };
  }

  @Get('db')
  checkDatabase(): Promise<{ status: 'ok'; database: 'connected' }> {
    return this.healthService.checkDatabase();
  }
}

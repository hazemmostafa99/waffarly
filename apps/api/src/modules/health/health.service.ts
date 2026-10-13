import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<{ status: 'ok'; database: 'connected' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable.',
        cause: error,
      });
    }
  }
}

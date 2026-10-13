import { Injectable } from '@nestjs/common';
import { parseEnvironment } from './environment.js';

@Injectable()
export class AppConfiguration {
  private readonly environment = parseEnvironment(process.env);

  get port(): number {
    return this.environment.PORT;
  }

  get databaseUrl(): string {
    return this.environment.DATABASE_URL;
  }

  get corsOrigins(): string[] {
    return this.environment.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get superAdminUsername(): string {
    return this.environment.SUPER_ADMIN_USERNAME.trim().toLowerCase();
  }

  get superAdminPasswordHash(): string {
    return this.environment.SUPER_ADMIN_PASSWORD_HASH;
  }

  get isProduction(): boolean {
    return this.environment.NODE_ENV === 'production';
  }
}

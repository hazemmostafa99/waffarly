import { Injectable } from '@nestjs/common';
import { resolve } from 'node:path';
import { parseEnvironment } from './environment.js';

@Injectable()
export class AppConfiguration {
  private readonly environment = parseEnvironment(process.env);

  get port(): number {
    return this.environment.PORT;
  }

  get publicApiBaseUrl(): string {
    return (this.environment.PUBLIC_API_BASE_URL ?? `http://localhost:${this.port}`).replace(
      /\/$/,
      '',
    );
  }

  get mediaStorageDirectory(): string {
    return resolve(process.cwd(), this.environment.MEDIA_STORAGE_DIRECTORY);
  }

  get databaseUrl(): string {
    return this.environment.DATABASE_URL;
  }

  get corsOrigins(): string[] {
    return this.environment.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get storefrontBaseDomain(): string | undefined {
    return this.environment.STOREFRONT_BASE_DOMAIN;
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

  get isDevelopment(): boolean {
    return this.environment.NODE_ENV === 'development';
  }
}

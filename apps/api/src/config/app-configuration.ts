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
}

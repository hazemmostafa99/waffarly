import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  DATABASE_STARTUP_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  DATABASE_STARTUP_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(5_000).default(1_000),
  PUBLIC_API_BASE_URL: z.string().url().optional().refine(isPublicApiOrigin, {
    message: 'must be a public API origin without a path, query, or fragment',
  }),
  MEDIA_STORAGE_DIRECTORY: z.string().trim().min(1).default('./uploads/catalog'),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
      message: 'must be a PostgreSQL connection URL',
    }),
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175',
    ),
  STOREFRONT_BASE_DOMAIN: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)
    .optional(),
  SUPER_ADMIN_USERNAME: z.string().max(80).default(''),
  SUPER_ADMIN_PASSWORD_HASH: z.string().max(255).default(''),
});

function isPublicApiOrigin(value: string | undefined): boolean {
  if (value === undefined) return true;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(environment: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(environment);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

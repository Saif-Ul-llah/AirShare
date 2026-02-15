import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/airshare'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('airshare'),
  R2_PUBLIC_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().default('change-this-secret-in-production'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

function parseOriginList(value?: string): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    ...parseOriginList(env.CORS_ORIGIN),
    ...parseOriginList(env.CORS_ORIGINS),
  ]);

  if (origins.size === 0) {
    return DEFAULT_CORS_ORIGINS;
  }

  return Array.from(origins);
}

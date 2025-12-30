import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const logLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PROXY_API_KEY: z.string().min(1, 'PROXY_API_KEY is required'),
  GCP_PROJECT_ID: z.string().min(1, 'GCP_PROJECT_ID is required'),
  GCP_LOCATION: z.string().min(1, 'GCP_LOCATION is required'),
  VEO_MODEL_ID: z.string().min(1, 'VEO_MODEL_ID is required'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: logLevelSchema.default('info'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
  // Avoid logging raw env values to keep secrets out of logs.
  // eslint-disable-next-line no-console
  console.error('Configuration validation failed', messages);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  proxyApiKey: env.PROXY_API_KEY,
  gcpProjectId: env.GCP_PROJECT_ID,
  gcpLocation: env.GCP_LOCATION,
  veoModelId: env.VEO_MODEL_ID,
  requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
  rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  logLevel: env.LOG_LEVEL,
};

export type AppConfig = typeof config;

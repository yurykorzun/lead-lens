import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SF_LOGIN_URL: z.string().url(),
  SF_CONSUMER_KEY: z.string().min(1),
  SF_CONSUMER_SECRET: z.string().min(1),
  SF_API_VERSION: z.string().default('v62.0'),
  DATABASE_URL: z.string().url(),
  APP_JWT_SECRET: z.string().min(1),
  APP_JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
      throw new Error('Invalid environment variables');
    }
    _env = result.data;
  }
  return _env;
}

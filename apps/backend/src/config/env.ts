import path from 'path';
import dotenv from 'dotenv';

// Root monorepo .env adalah sumber utama; apps/backend/.env hanya fallback.
// dotenv tidak menimpa variabel yang sudah ada, jadi urutan ini membuat root menang.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

import { z } from 'zod';

// Jest menjalankan test tanpa file .env; sediakan nilai aman khusus test.
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  process.env.NODE_ENV = 'test';
  process.env.DB_SERVER ??= 'localhost';
  process.env.DB_NAME ??= 'MiniWorldRS';
  process.env.DB_USER ??= 'sa';
  process.env.DB_PASSWORD ??= 'test-password';
  process.env.JWT_SECRET ??= 'test-jwt-secret-please-change';
}

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_SERVER: z.string().min(1, 'DB_SERVER is required'),
  DB_PORT: z.string().default('1433').transform((val) => parseInt(val, 10)),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_ENCRYPT: z.string().default('false').transform((val) => val === 'true'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('30m'),
  // TODO(deploy): ganti default dev dengan domain produksi Vercel sebelum rilis (lihat .env.example)
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z.string().default('300').transform((val) => parseInt(val, 10)),
  AUTH_RATE_LIMIT_MAX: z.string().default('20').transform((val) => parseInt(val, 10)),
  DEFAULT_UNIT_BIDAN_ID: z.string().uuid().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Alamat pengirim yang sudah diverifikasi di Brevo (bukan user relay SMTP).
  SENDER_EMAIL: z.string().email().optional()
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Configuration validation error:', JSON.stringify(result.error.format(), null, 2));
  throw new Error('Invalid environment variables. Check .env configuration.');
}

export const config = Object.freeze({
  ...result.data,
  ALLOWED_ORIGINS: result.data.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
});
export type Config = typeof config;
export default config;

import { z } from 'zod';
import ApiError from '../errors/ApiError';

export const emptyBodySchema = z.object({});

export const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const uuidSchema = z.string().trim().regex(GUID_REGEX, 'Format ID tidak valid');
export const idParams = z.object({ id: uuidSchema });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const dateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, 'Format tanggal/waktu tidak valid');

export const phoneSchema = z
  .string()
  .regex(/^(0|\+62)\d{8,}$/, 'Nomor telepon harus diawali 0 atau +62 dan minimal 10 digit');

export const nikSchema = z.string().regex(/^\d{16}$/, 'NIK harus 16 digit angka');

export const optionalEmailSchema = z.string().email('Format email tidak valid').max(254).optional();

export const parseInput = <S extends z.ZodType>(schema: S, value: unknown, label: string): z.infer<S> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.validation(`Validasi ${label} gagal`, result.error.issues);
  }
  return result.data;
};

export const parseBody = <S extends z.ZodType>(schema: S, body: unknown): z.infer<S> =>
  parseInput(schema, body, 'body');

export const parseQuery = <S extends z.ZodType>(schema: S, query: unknown): z.infer<S> =>
  parseInput(schema, query, 'query');

export const parseParams = <S extends z.ZodType>(schema: S, params: unknown): z.infer<S> =>
  parseInput(schema, params, 'params');

export const paginate = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.trunc(parsed), max);
};

export const periodRange = (value: { dari?: string | null; sampai?: string | null }): void => {
  if (value.dari && value.sampai && value.dari > value.sampai) {
    throw ApiError.validation('Validasi periode gagal', [
      { path: ['dari'], message: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir' }
    ]);
  }
  if (value.dari && value.sampai) {
    const dari = new Date(value.dari);
    const sampai = new Date(value.sampai);
    const days = (sampai.getTime() - dari.getTime()) / 86_400_000;
    if (days > 366) {
      throw ApiError.validation('Validasi periode gagal', [
        { path: ['sampai'], message: 'Rentang periode maksimal 366 hari' }
      ]);
    }
  }
};

export default {
  emptyBodySchema,
  uuidSchema,
  idParams,
  paginationSchema,
  limitSchema,
  dateSchema,
  dateTimeSchema,
  phoneSchema,
  nikSchema,
  optionalEmailSchema,
  parseInput,
  parseBody,
  parseQuery,
  parseParams,
  paginate,
  periodRange
};

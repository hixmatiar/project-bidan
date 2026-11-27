import { z } from 'zod';
import { dateSchema, uuidSchema } from './common';

export const reservasiListSchema = z.object({
  tanggal: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const jadwalUlangSchema = z.object({
  jadwal_id: uuidSchema,
  nomor_antrean: z.number().int().min(1).optional(),
  estimasi_jam: z.string().max(20).optional()
});

export const statusSchema = z.object({
  status: z.enum(['MENUNGGU', 'DIPANGGIL', 'DILAYANI', 'SELESAI', 'BATAL', 'TIDAK_HADIR'])
});

export const jadwalSchema = z.object({
  staf_id: uuidSchema.optional(),
  unit_id: uuidSchema.optional(),
  ruangan_id: uuidSchema.optional(),
  tanggal: dateSchema,
  jam_mulai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam tidak valid'),
  jam_selesai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam tidak valid'),
  kuota_maks: z.number().int().min(1).max(500),
  durasi_per_pasien: z.number().int().min(5).max(240)
});

export const jadwalUpdateSchema = z.object({
  jam_mulai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam tidak valid').optional(),
  jam_selesai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam tidak valid').optional(),
  kuota_maks: z.number().int().min(1).max(500).optional(),
  durasi_per_pasien: z.number().int().min(5).max(240).optional(),
  aktif: z.boolean().optional()
});

export type ReservasiListInput = z.infer<typeof reservasiListSchema>;
export type JadwalUlangBody = z.infer<typeof jadwalUlangSchema>;
export type StatusBody = z.infer<typeof statusSchema>;
export type JadwalBody = z.infer<typeof jadwalSchema>;
export type JadwalUpdateBody = z.infer<typeof jadwalUpdateSchema>;

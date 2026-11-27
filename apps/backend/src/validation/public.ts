import { z } from 'zod';
import { uuidSchema } from './common';

export const kontenListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  tipe: z.string().max(20).optional()
});

export const layananListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  unit_id: uuidSchema.optional()
});

export const jadwalListSchema = layananListSchema;

export const cekPasienSchema = z
  .object({
    nik: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit angka').optional(),
    no_rm: z.string().max(30).optional()
  })
  .refine((value) => Boolean(value.nik ?? value.no_rm), {
    message: 'nik atau no_rm wajib diisi'
  });

export const reservasiSchema = z.object({
  pasien_id: uuidSchema.optional(),
  jadwal_id: uuidSchema.optional(),
  sesi_id: uuidSchema.optional(),
  layanan_id: uuidSchema,
  metode_daftar: z.enum(['ONLINE', 'WALK_IN', 'TELEPON']).default('ONLINE'),
  nik: z.string().optional(),
  nama: z.string().optional(),
  no_hp: z.string().optional(),
  email: z.string().optional(),
  jenis_kelamin: z.enum(['P', 'L']).optional(),
  keluhan: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional()
});

export type KontenListInput = z.infer<typeof kontenListSchema>;
export type LayananListInput = z.infer<typeof layananListSchema>;
export type CekPasienInput = z.infer<typeof cekPasienSchema>;
export type ReservasiInput = z.infer<typeof reservasiSchema>;

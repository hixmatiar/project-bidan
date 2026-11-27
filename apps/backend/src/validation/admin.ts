import { z } from 'zod';
import { dateSchema, uuidSchema } from './common';

export const akunSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  peran: z.enum(['SUPERADMIN', 'ADMIN_LOKAL', 'DOKTER', 'STAFF']),
  sub_peran: z.enum(['PERAWAT', 'RESEPSIONIS']).optional()
});

export const pemeliharaanSchema = z.object({
  teknisi_staf_id: uuidSchema,
  jenis: z.string().min(1).max(50),
  tanggal: dateSchema,
  biaya: z.number().min(0).default(0),
  hasil: z.string().max(1000).optional(),
  jadwal_berikutnya: dateSchema.optional()
});

export type AkunBody = z.infer<typeof akunSchema>;
export type PemeliharaanBody = z.infer<typeof pemeliharaanSchema>;

import { z } from 'zod';
import { dateSchema, nikSchema, optionalEmailSchema, phoneSchema } from './common';

export const pasienSearchSchema = z.object({
  q: z.string().min(3, 'Pencarian minimal 3 karakter').max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const walkInSchema = z.object({
  nik: nikSchema,
  nama: z.string().min(1).max(100),
  jenis_kelamin: z.string().min(1).max(20),
  tgl_lahir: dateSchema,
  tempat_lahir: z.string().min(1).max(100),
  alamat: z.string().min(1).max(255),
  no_telepon: phoneSchema,
  gol_darah: z.string().min(1).max(20),
  status_pernikahan: z.string().min(1).max(20),
  pekerjaan: z.string().max(100),
  email: optionalEmailSchema,
  unit_id: z.string().uuid(),
  dpjp_staf_id: z.string().uuid().optional(),
  penjamin_id: z.string().uuid().optional(),
  layanan_id: z.string().uuid().optional(),
  jadwal_id: z.string().uuid().optional(),
  jenis_kunjungan: z.string().max(30).default('RAWAT_JALAN')
});

export const alergiSchema = z.object({
  obat_id: z.string().uuid().optional(),
  kategori: z.string().min(1).max(30),
  nama: z.string().min(1).max(100),
  keterangan: z.string().max(255).optional()
});

export const alergiUpdateSchema = z.object({
  kategori: z.string().min(1).max(30).optional(),
  nama: z.string().min(1).max(100).optional(),
  keterangan: z.string().max(255).optional(),
  aktif: z.boolean().optional()
});

export const konfirmasiRedFlagSchema = z.object({
  kunjungan_id: z.string().uuid().optional(),
  catatan: z.string().max(500).optional()
});

export type PasienSearchInput = z.infer<typeof pasienSearchSchema>;
export type WalkInBody = z.infer<typeof walkInSchema>;
export type AlergiBody = z.infer<typeof alergiSchema>;
export type AlergiUpdateBody = z.infer<typeof alergiUpdateSchema>;
export type KonfirmasiRedFlagBody = z.infer<typeof konfirmasiRedFlagSchema>;

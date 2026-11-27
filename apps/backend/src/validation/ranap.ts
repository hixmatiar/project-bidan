import { z } from 'zod';
import { dateSchema, dateTimeSchema, uuidSchema } from './common';

export const ranapListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional()
});

export const admisiSchema = z.object({
  bed_id: uuidSchema,
  catatan: z.string().max(500).optional()
});

export const pindahSchema = z.object({
  bed_id: uuidSchema,
  alasan_pindah: z.string().max(255).optional()
});

export const pulangSchema = z.object({
  cara_keluar: z.enum(['SEMBUH', 'DIRUJUK', 'APS', 'MENINGGAL']),
  catatan_pulang: z.string().max(2000).optional()
});

export const visiteSchema = z.object({
  catatan: z.string().min(1).max(2000)
});

export const triaseSchema = z.object({
  level: z.enum(['P1', 'P2', 'P3', 'P4', 'P5']),
  keluhan_utama: z.string().min(1).max(500),
  keputusan: z.string().max(255).optional()
});

export const operasiSchema = z.object({
  layanan_id: uuidSchema,
  ruangan_id: uuidSchema,
  jenis_anestesi: z.string().max(30),
  jadwal_mulai: dateTimeSchema
});

export const operasiUpdateSchema = z.object({
  waktu_mulai: dateTimeSchema.optional(),
  waktu_selesai: dateTimeSchema.optional(),
  status: z.enum(['DIJADWALKAN', 'BERLANGSUNG', 'SELESAI', 'BATAL']).optional(),
  laporan: z.string().max(4000).optional()
});

export const ambulansSchema = z.object({
  aset_id: uuidSchema.optional(),
  plat_nomor: z.string().min(1).max(20),
  jenis: z.string().max(30),
  tahun: z.number().int().min(1950).max(2100),
  kapasitas: z.number().int().min(1).max(20),
  status: z.string().max(20).default('SIAP'),
  tgl_kir_berikutnya: dateSchema.optional()
});

export const perjalananSchema = z.object({
  pasien_id: uuidSchema,
  layanan_id: uuidSchema,
  kunjungan_id: uuidSchema.optional(),
  asal: z.string().max(255),
  tujuan: z.string().max(255),
  waktu_berangkat: dateTimeSchema.optional(),
  jarak_km: z.number().min(0).optional()
});

export type RanapListInput = z.infer<typeof ranapListSchema>;
export type AdmisiBody = z.infer<typeof admisiSchema>;
export type PindahBody = z.infer<typeof pindahSchema>;
export type PulangBody = z.infer<typeof pulangSchema>;
export type VisiteBody = z.infer<typeof visiteSchema>;
export type TriaseBody = z.infer<typeof triaseSchema>;
export type OperasiBody = z.infer<typeof operasiSchema>;
export type OperasiUpdateBody = z.infer<typeof operasiUpdateSchema>;
export type AmbulansBody = z.infer<typeof ambulansSchema>;
export type PerjalananBody = z.infer<typeof perjalananSchema>;

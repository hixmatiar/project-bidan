import { z } from 'zod';
import { dateSchema, uuidSchema } from './common';

export const asuhanSchema = z.object({
  imd: z.boolean().default(false),
  vit_k1: z.boolean().default(false),
  salep_mata: z.boolean().default(false),
  hb0: z.boolean().default(false),
  keadaan_umum: z.string().min(1).max(100),
  catatan: z.string().max(1000).optional()
});

export const pemeriksaanSchema = z.object({
  kunjungan_id: uuidSchema.optional(),
  jenis: z.enum(['KN1', 'KN2', 'KN3', 'TUMBUH_KEMBANG']),
  tgl_pemeriksaan: dateSchema,
  berat_gram: z.number().int().min(200).max(40000),
  panjang_cm: z.number().min(20).max(150),
  lingkar_kepala_cm: z.number().min(15).max(80).optional(),
  suhu_c: z.number().min(30).max(45).optional(),
  kondisi_tali_pusat: z.enum(['KERING', 'BASAH', 'INFEKSI']).optional(),
  menyusu: z.enum(['ASI_EKSKLUSIF', 'CAMPURAN', 'FORMULA']).optional(),
  ikterus: z.boolean().default(false),
  tanda_bahaya: z.boolean().default(false),
  tgl_kontrol_berikutnya: dateSchema.optional(),
  catatan: z.string().max(1000).optional()
});

export type AsuhanBody = z.infer<typeof asuhanSchema>;
export type PemeriksaanBody = z.infer<typeof pemeriksaanSchema>;

import { z } from 'zod';
import { dateSchema } from './common';

export const klinisLimitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const diagnosaSchema = z.object({
  kode_icd: z.string().min(1).max(20),
  nama: z.string().min(1).max(255),
  jenis: z.enum(['UTAMA', 'SEKUNDER', 'KOMPLIKASI']).default('SEKUNDER')
});

export const kunjunganSchema = z.object({
  unit_id: z.string().uuid(),
  dpjp_staf_id: z.string().uuid().optional(),
  penjamin_id: z.string().uuid().optional(),
  jenis_kunjungan: z.string().max(30).default('RAWAT_JALAN'),
  diagnosa: z.array(diagnosaSchema).default([]),
  layanan_ids: z.array(z.string().uuid()).default([])
});

export const catatanSchema = z.object({
  jenis: z.enum(['CPPT', 'ASUHAN_KEPERAWATAN', 'EVALUASI_MEDIS']).default('CPPT'),
  isi: z.string().min(1).max(2000)
});

export const kehamilanSchema = z.object({
  hpht: dateSchema,
  hpl: dateSchema.optional(),
  gravida: z.number().int().min(0).default(0),
  paritas: z.number().int().min(0).default(0),
  abortus: z.number().int().min(0).default(0),
  status_risiko: z.string().max(30).default('RENDAH'),
  status: z.string().max(30).default('AKTIF')
});

export const ancSchema = z.object({
  kunjungan_ke: z.number().int().min(1).max(20),
  usia_kehamilan_minggu: z.number().int().min(1).max(45),
  tinggi_fundus: z.number().int().min(1).max(60).optional(),
  djj: z.number().int().min(60).max(220).optional(),
  letak_janin: z.string().max(30).optional(),
  tablet_fe_diberikan: z.boolean().default(false)
});

export const persalinanSchema = z.object({
  kunjungan_id: z.string().uuid(),
  penolong_staf_id: z.string().uuid().optional(),
  waktu_persalinan: z.string().max(40).optional(),
  jenis_persalinan: z.string().min(1).max(30),
  komplikasi: z.string().max(255).optional(),
  kondisi_ibu: z.string().max(30).default('STABIL')
});

export const klinisBayiSchema = z.object({
  berat_lahir_gram: z.number().int().min(200).max(7000),
  panjang_lahir_cm: z.number().min(20).max(80),
  apgar_1: z.number().int().min(0).max(10).optional(),
  apgar_5: z.number().int().min(0).max(10).optional(),
  kondisi: z.string().max(30).default('SEHAT'),
  nama: z.string().min(1).max(100),
  jenis_kelamin: z.enum(['LAKI_LAKI', 'PEREMPUAN']),
  tgl_lahir: dateSchema,
  ibu_pasien_id: z.string().uuid()
});

export const imunisasiSchema = z.object({
  vaksin_id: z.string().uuid(),
  kunjungan_id: z.string().uuid(),
  batch_id: z.string().uuid().optional(),
  dosis_ke: z.number().int().min(1).max(10),
  tanggal: dateSchema
});

export const kbSchema = z.object({
  metode_id: z.string().uuid(),
  kunjungan_id: z.string().uuid(),
  tanggal: dateSchema,
  kontrol_berikutnya: dateSchema.optional(),
  efek_samping: z.string().max(255).optional()
});

export type LimitInput = z.infer<typeof klinisLimitSchema>;
export type KunjunganBody = z.infer<typeof kunjunganSchema>;
export type CatatanBody = z.infer<typeof catatanSchema>;
export type KehamilanBody = z.infer<typeof kehamilanSchema>;
export type AncBody = z.infer<typeof ancSchema>;
export type PersalinanBody = z.infer<typeof persalinanSchema>;
export type KlinisBayiBody = z.infer<typeof klinisBayiSchema>;
export type ImunisasiBody = z.infer<typeof imunisasiSchema>;
export type KbBody = z.infer<typeof kbSchema>;

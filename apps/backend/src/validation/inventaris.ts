import { z } from 'zod';
import { dateSchema, uuidSchema } from './common';

export const stokListSchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const obatSchema = z.object({
  kode: z.string().trim().min(1).max(30),
  nama_generik: z.string().trim().min(1).max(100),
  nama_dagang: z.string().trim().max(100).optional(),
  kategori: z.string().trim().min(1).max(30),
  bentuk: z.string().trim().min(1).max(30),
  satuan: z.string().trim().min(1).max(20),
  kekuatan: z.string().trim().max(50).optional(),
  golongan: z.string().trim().max(30).optional(),
  stok_minimum: z.coerce.number().int().min(0).default(0),
  stok_awal: z.coerce.number().int().min(0).optional(),
  stok_saat_ini: z.coerce.number().int().min(0).optional()
});

export const obatUpdateSchema = z.object({
  nama_dagang: z.string().max(100).optional(),
  stok_minimum: z.coerce.number().int().min(0).optional(),
  stok_saat_ini: z.coerce.number().int().min(0).optional(),
  aktif: z.boolean().optional()
});

export const restockSchema = z.object({
  gudang_id: uuidSchema.optional(),
  no_batch: z.string().min(1).max(50).optional(),
  tgl_kedaluwarsa: dateSchema.optional(),
  harga_beli: z.number().min(0).default(0),
  jumlah: z.number().int().min(1),
  jenis: z.enum(['MASUK', 'KELUAR']).optional(),
  keterangan: z.string().max(255).optional()
});

export const batchSchema = z.object({
  no_batch: z.string().min(1).max(50),
  tgl_kedaluwarsa: dateSchema,
  harga_beli: z.number().min(0),
  gudang_id: uuidSchema,
  jumlah: z.number().int().min(1)
});

export const resepPengeluaranSchema = z.object({
  gudang_id: uuidSchema,
  kunjungan_id: uuidSchema.optional()
});

export type StokListInput = z.infer<typeof stokListSchema>;
export type ObatBody = z.infer<typeof obatSchema>;
export type ObatUpdateBody = z.infer<typeof obatUpdateSchema>;
export type RestockBody = z.infer<typeof restockSchema>;
export type BatchBody = z.infer<typeof batchSchema>;
export type ResepPengeluaranBody = z.infer<typeof resepPengeluaranSchema>;

import { z } from 'zod';
import { dateSchema, uuidSchema } from './common';

export const tagihanListSchema = z.object({
  status: z.string().max(20).optional(),
  dari: dateSchema.nullable().optional(),
  sampai: dateSchema.nullable().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const bayarSchema = z.object({
  jumlah: z.number().positive(),
  metode: z.enum(['TUNAI', 'TRANSFER', 'KARTU', 'QRIS', 'BPJS']),
  jenis: z.enum(['UANG_MUKA', 'CICILAN', 'PELUNASAN']).default('PELUNASAN'),
  penjamin_id: uuidSchema.optional(),
  kasir_staf_id: uuidSchema.optional()
});

export const hargaSchema = z.object({
  harga: z.number().positive(),
  kelas_id: uuidSchema.optional(),
  penjamin_id: uuidSchema.optional(),
  berlaku_dari: dateSchema.optional(),
  alasan: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(255)
});

export const refParams = z.object({
  ref_tipe: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(['LAYANAN', 'OBAT'], { message: 'ref_tipe harus LAYANAN atau OBAT' })),
  ref_id: uuidSchema
});

export type TagihanListInput = z.infer<typeof tagihanListSchema>;
export type BayarBody = z.infer<typeof bayarSchema>;
export type HargaBody = z.infer<typeof hargaSchema>;
export type RefParams = z.infer<typeof refParams>;

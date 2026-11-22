import { z } from 'zod';
import { dateSchema } from './common';

export const tagihanListSchema = z.object({
  status: z.string().max(20).optional(),
  dari: dateSchema.optional(),
  sampai: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const bayarSchema = z.object({
  jumlah: z.number().positive(),
  metode: z.enum(['TUNAI', 'TRANSFER', 'KARTU', 'BPJS', 'ASURANSI']),
  jenis: z.enum(['PENUH', 'SEBAGIAN']).default('PENUH'),
  penjamin_id: z.string().uuid().optional()
});

export const hargaSchema = z.object({
  harga: z.number().positive(),
  kelas_id: z.string().uuid().optional(),
  penjamin_id: z.string().uuid().optional(),
  berlaku_dari: dateSchema.optional(),
  alasan: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(255)
});

export const refParams = z.object({
  ref_tipe: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(['LAYANAN', 'OBAT'], { message: 'ref_tipe harus LAYANAN atau OBAT' })),
  ref_id: z.string().uuid('Format ID tidak valid')
});

export type TagihanListInput = z.infer<typeof tagihanListSchema>;
export type BayarBody = z.infer<typeof bayarSchema>;
export type HargaBody = z.infer<typeof hargaSchema>;
export type RefParams = z.infer<typeof refParams>;

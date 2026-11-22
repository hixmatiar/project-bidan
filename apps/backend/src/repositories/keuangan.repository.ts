import db from '../db/pool';

export class KeuanganRepository {
  async findPenjaminMandiri(): Promise<string | null> {
    const result = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id
         FROM [Penjamin]
        WHERE aktif = 1 AND (jenis = 'MANDIRI' OR nama LIKE '%Mandiri%')
        ORDER BY nama ASC`,
      {}
    );
    return result.recordset[0]?.penjamin_id ?? null;
  }

  async kunjunganExists(kunjunganId: string): Promise<boolean> {
    const result = await db.query<{ ada: number }>(
      `SELECT TOP 1 1 AS ada FROM [Kunjungan] WHERE kunjungan_id = @id`,
      { id: kunjunganId }
    );
    return result.recordset.length > 0;
  }

  async findTagihanIdByKunjungan(kunjunganId: string): Promise<string | null> {
    const result = await db.query<{ tagihan_id: string }>(
      `SELECT TOP 1 tagihan_id FROM [Tagihan] WHERE kunjungan_id = @id`,
      { id: kunjunganId }
    );
    return result.recordset[0]?.tagihan_id ?? null;
  }

  async createTagihan(kunjunganId: string): Promise<string | null> {
    const result = await db.query<{ tagihan_id: string }>(
      `INSERT INTO [Tagihan] (kunjungan_id, total_tagihan, total_dibayar, status, tgl_terbit)
       OUTPUT INSERTED.tagihan_id
       VALUES (@id, 0, 0, 'BELUM_LUNAS', SYSDATETIME())`,
      { id: kunjunganId }
    );
    return result.recordset[0]?.tagihan_id ?? null;
  }

  async listRincian(tagihanId: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT tr.rincian_id, tr.obat_id, tr.layanan_id, tr.paket_id, tr.qty,
              tr.harga_satuan, tr.subtotal
         FROM [Tagihan_Rincian] tr WHERE tr.tagihan_id = @id`,
      { id: tagihanId }
    );
    return result.recordset;
  }

  async findTagihan(tagihanId: string): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [Tagihan] WHERE tagihan_id = @id`,
      { id: tagihanId }
    );
    return result.recordset[0];
  }

  async createPembayaran(input: {
    tagihanId: string;
    penjaminId?: string;
    kasirStafId: string | null;
    jumlah: number;
    metode: string;
    jenis: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO [Pembayaran] (tagihan_id, penjamin_id, kasir_staf_id, jumlah, metode, jenis, waktu_bayar)
       VALUES (@tagihan_id, @penjamin_id, @kasir, @jumlah, @metode, @jenis, SYSDATETIME())`,
      {
        tagihan_id: input.tagihanId,
        penjamin_id: input.penjaminId ?? null,
        kasir: input.kasirStafId,
        jumlah: input.jumlah,
        metode: input.metode,
        jenis: input.jenis
      }
    );
  }

  async updatePembayaranTagihan(
    id: string,
    totalDibayar: number,
    status: string
  ): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Tagihan]
          SET total_dibayar = @dibayar, status = @status
        OUTPUT INSERTED.*
        WHERE tagihan_id = @id`,
      { id, dibayar: totalDibayar, status }
    );
    return result.recordset[0];
  }

  async listTagihan(
    limit: number,
    status: string | null,
    dari: string | null,
    sampai: string | null
  ): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) t.*, p.nama AS nama_pasien
         FROM [Tagihan] t
         JOIN [Kunjungan] k ON k.kunjungan_id = t.kunjungan_id
         JOIN [Pasien] p ON p.pasien_id = k.pasien_id
        WHERE (@status IS NULL OR t.status = @status)
          AND (@dari IS NULL OR t.tgl_terbit >= CAST(@dari AS DATE))
          AND (@sampai IS NULL OR t.tgl_terbit < DATEADD(DAY, 1, CAST(@sampai AS DATE)))
        ORDER BY t.tgl_terbit DESC`,
      { limit, status, dari, sampai }
    );
    return result.recordset;
  }

  async rekap(dari: string | null, sampai: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT CAST(pb.waktu_bayar AS DATE) AS tanggal, pb.metode,
              COUNT(*) AS jumlah_transaksi, SUM(pb.jumlah) AS total
         FROM [Pembayaran] pb
        WHERE (@dari IS NULL OR pb.waktu_bayar >= CAST(@dari AS DATE))
          AND (@sampai IS NULL OR pb.waktu_bayar < DATEADD(DAY, 1, CAST(@sampai AS DATE)))
        GROUP BY CAST(pb.waktu_bayar AS DATE), pb.metode
        ORDER BY tanggal DESC, pb.metode ASC`,
      { dari, sampai }
    );
    return result.recordset;
  }

  async listHargaLayanan(): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT hl.harga_layanan_id, hl.layanan_id, l.nama, hl.kelas_id, hl.penjamin_id,
              hl.harga, hl.berlaku_dari, hl.berlaku_sampai
         FROM [Harga_Layanan] hl
         JOIN [Layanan_Medis] l ON l.layanan_id = hl.layanan_id
        WHERE hl.berlaku_sampai IS NULL OR hl.berlaku_sampai >= CAST(SYSDATETIME() AS DATE)`
    );
    return result.recordset;
  }

  async listHargaObat(): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT ho.harga_obat_id, ho.obat_id, o.nama_generik, ho.harga_jual,
              ho.berlaku_dari, ho.berlaku_sampai
         FROM [Harga_Obat] ho
         JOIN [Obat] o ON o.obat_id = ho.obat_id
        WHERE ho.berlaku_sampai IS NULL OR ho.berlaku_sampai >= CAST(SYSDATETIME() AS DATE)`
    );
    return result.recordset;
  }

  async closeHargaLayanan(layananId: string): Promise<void> {
    await db.query(
      `UPDATE [Harga_Layanan] SET berlaku_sampai = SYSDATETIME()
        WHERE layanan_id = @id AND berlaku_sampai IS NULL`,
      { id: layananId }
    );
  }

  async insertHargaLayanan(input: {
    layananId: string;
    kelasId?: string;
    penjaminId?: string;
    stafId: string | null;
    harga: number;
    berlakuDari?: string;
    alasan?: string;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Harga_Layanan]
         (layanan_id, kelas_id, penjamin_id, diubah_oleh, harga, berlaku_dari, alasan)
       OUTPUT INSERTED.*
       VALUES (@layanan_id, @kelas_id, @penjamin_id, @staf, @harga,
               ISNULL(CAST(@dari AS DATE), CAST(SYSDATETIME() AS DATE)), @alasan)`,
      {
        layanan_id: input.layananId,
        kelas_id: input.kelasId ?? null,
        penjamin_id: input.penjaminId ?? null,
        staf: input.stafId,
        harga: input.harga,
        dari: input.berlakuDari ?? null,
        alasan: input.alasan ?? null
      }
    );
    return result.recordset[0];
  }

  async closeHargaObat(obatId: string): Promise<void> {
    await db.query(
      `UPDATE [Harga_Obat] SET berlaku_sampai = SYSDATETIME()
        WHERE obat_id = @id AND berlaku_sampai IS NULL`,
      { id: obatId }
    );
  }

  async insertHargaObat(input: {
    obatId: string;
    stafId: string | null;
    harga: number;
    berlakuDari?: string;
    alasan?: string;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Harga_Obat] (obat_id, diubah_oleh, harga_jual, berlaku_dari, alasan)
       OUTPUT INSERTED.*
       VALUES (@obat_id, @staf, @harga, ISNULL(CAST(@dari AS DATE), CAST(SYSDATETIME() AS DATE)), @alasan)`,
      {
        obat_id: input.obatId,
        staf: input.stafId,
        harga: input.harga,
        dari: input.berlakuDari ?? null,
        alasan: input.alasan ?? null
      }
    );
    return result.recordset[0];
  }

  async riwayatHargaLayanan(layananId: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [Harga_Layanan] WHERE layanan_id = @id ORDER BY berlaku_dari DESC`,
      { id: layananId }
    );
    return result.recordset;
  }

  async riwayatHargaObat(obatId: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [Harga_Obat] WHERE obat_id = @id ORDER BY berlaku_dari DESC`,
      { id: obatId }
    );
    return result.recordset;
  }
}

export default KeuanganRepository;

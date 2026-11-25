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

  async findPenjaminBpjs(): Promise<string | null> {
    const result = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id
         FROM [Penjamin]
        WHERE aktif = 1 AND (jenis = 'BPJS' OR nama LIKE '%BPJS%')
        ORDER BY nama ASC`,
      {}
    );
    return result.recordset[0]?.penjamin_id ?? null;
  }

  async findAnyPenjamin(): Promise<string | null> {
    const result = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id FROM [Penjamin] WHERE aktif = 1 ORDER BY nama ASC`,
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

  async findOrCreateKunjunganByPasien(pasienId: string): Promise<string | null> {
    const existing = await db.query<{ kunjungan_id: string }>(
      `SELECT TOP 1 kunjungan_id FROM [Kunjungan] WHERE pasien_id = @id ORDER BY tgl_masuk DESC`,
      { id: pasienId }
    );
    if (existing.recordset[0]?.kunjungan_id) {
      return existing.recordset[0].kunjungan_id;
    }
    const unitRes = await db.query<{ unit_id: string }>(
      `SELECT TOP 1 unit_id FROM [Unit_Pelayanan] WHERE aktif = 1 ORDER BY nama ASC`,
      {}
    );
    const dpjpRes = await db.query<{ staf_id: string }>(
      `SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1 ORDER BY nama ASC`,
      {}
    );
    const penjaminRes = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id FROM [Penjamin] WHERE aktif = 1 ORDER BY nama ASC`,
      {}
    );
    const unitId = unitRes.recordset[0]?.unit_id;
    const dpjpId = dpjpRes.recordset[0]?.staf_id;
    const penjaminId = penjaminRes.recordset[0]?.penjamin_id;
    if (!unitId || !dpjpId || !penjaminId) {
      return null;
    }
    const created = await db.query<{ kunjungan_id: string }>(
      `INSERT INTO [Kunjungan] (pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, status, tgl_masuk)
       OUTPUT INSERTED.kunjungan_id
       VALUES (@pasienId, @unitId, @dpjpId, @penjaminId, 'RAWAT_JALAN', 'SELESAI', SYSDATETIME())`,
      { pasienId, unitId, dpjpId, penjaminId }
    );
    return created.recordset[0]?.kunjungan_id ?? null;
  }

  async saveRincian(
    tagihanId: string,
    items: Array<{
      layanan_id?: string | null;
      obat_id?: string | null;
      paket_id?: string | null;
      qty?: number;
      harga_satuan?: number;
      subtotal?: number;
    }>
  ): Promise<number> {
    let total = 0;
    for (const item of items) {
      const qty = item.qty && item.qty > 0 ? Number(item.qty) : 1;
      const harga = item.harga_satuan ? Number(item.harga_satuan) : 0;
      const subtotal = item.subtotal !== undefined ? Number(item.subtotal) : qty * harga;
      total += subtotal;
      await db.query(
        `INSERT INTO [Tagihan_Rincian] (tagihan_id, layanan_id, obat_id, paket_id, qty, harga_satuan, subtotal)
         VALUES (@tagihan_id, @layanan_id, @obat_id, @paket_id, @qty, @harga_satuan, @subtotal)`,
        {
          tagihan_id: tagihanId,
          layanan_id: item.layanan_id ?? null,
          obat_id: item.obat_id ?? null,
          paket_id: item.paket_id ?? null,
          qty,
          harga_satuan: harga,
          subtotal
        }
      );
    }
    await db.query(
      `UPDATE [Tagihan]
          SET total_tagihan = @total,
              status = CASE WHEN total_dibayar >= @total AND @total > 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END
        WHERE tagihan_id = @id`,
      { id: tagihanId, total }
    );
    return total;
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
      `SELECT TOP (@limit)
              t.tagihan_id,
              t.kunjungan_id,
              t.total_tagihan,
              t.total_dibayar,
              t.total_tagihan AS total,
              t.total_dibayar AS terbayar,
              (t.total_tagihan - t.total_dibayar) AS sisa,
              t.status,
              t.tgl_terbit,
              CONCAT('INV-', REPLACE(CONVERT(VARCHAR(10), t.tgl_terbit, 120), '-', ''), '-', UPPER(SUBSTRING(CAST(t.tagihan_id AS VARCHAR(36)), 1, 6))) AS no_tagihan,
              p.nama AS nama_pasien,
              p.no_rm,
              p.nik
         FROM [Tagihan] t
         LEFT JOIN [Kunjungan] k ON k.kunjungan_id = t.kunjungan_id
         LEFT JOIN [Pasien] p ON p.pasien_id = k.pasien_id
        WHERE (@status IS NULL OR t.status = @status)
          AND (@dari IS NULL OR t.tgl_terbit >= CAST(@dari AS DATE))
          AND (@sampai IS NULL OR t.tgl_terbit < DATEADD(DAY, 1, CAST(@sampai AS DATE)))
        ORDER BY t.tgl_terbit DESC, t.tagihan_id DESC`,
      { limit, status, dari, sampai }
    );
    return result.recordset;
  }

  async rekap(dari: string | null, sampai: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT CAST(pb.waktu_bayar AS DATE) AS tanggal, pb.metode,
              COUNT(*) AS jumlah_transaksi, SUM(pb.jumlah) AS total
         FROM [Pembayaran] pb
        WHERE (@dari IS NULL OR @dari = '' OR pb.waktu_bayar >= CAST(@dari AS DATE))
          AND (@sampai IS NULL OR @sampai = '' OR pb.waktu_bayar < DATEADD(DAY, 1, CAST(@sampai AS DATE)))
        GROUP BY CAST(pb.waktu_bayar AS DATE), pb.metode
        ORDER BY tanggal DESC, pb.metode ASC`,
      { dari: dari || null, sampai: sampai || null }
    );
    return result.recordset;
  }

  async rincianPendapatanLayanan(): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT l.layanan_id, l.nama AS pos_layanan,
              COUNT(DISTINCT tr.tagihan_id) AS volume_pasien,
              COALESCE(SUM(tr.subtotal), 0) AS pendapatan_bruto,
              COALESCE(SUM(tr.subtotal * 0.35), 0) AS hpp_medis,
              COALESCE(SUM(tr.subtotal * 0.65), 0) AS margin_kontribusi
         FROM [Layanan_Medis] l
         LEFT JOIN [Tagihan_Rincian] tr ON tr.layanan_id = l.layanan_id
        GROUP BY l.layanan_id, l.nama
        ORDER BY pendapatan_bruto DESC`
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

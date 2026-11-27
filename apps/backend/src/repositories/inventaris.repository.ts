import db from '../db/pool';

export interface ObatBaru {
  kode: string;
  namaGenerik: string;
  namaDagang?: string;
  kategori: string;
  bentuk: string;
  satuan: string;
  kekuatan?: string;
  golongan?: string;
  stokMinimum: number;
  stokSaatIni?: number;
}

function normalizeKategoriDanGolongan(
  rawKategori: string,
  rawGolongan?: string
): { kategori: string; golongan: string } {
  const upperKat = (rawKategori || '').trim().toUpperCase().replace(/\s+/g, '_');
  const cleanGol = (rawGolongan || '').trim().toUpperCase();

  if (upperKat === 'ALKES' || upperKat === 'ALAT_KESEHATAN') {
    return {
      kategori: 'ALKES',
      golongan: (cleanGol || 'ALKES').slice(0, 20)
    };
  }
  if (upperKat === 'OBAT_BEBAS') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'BEBAS').slice(0, 20) };
  }
  if (upperKat === 'OBAT_BEBAS_TERBATAS') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'BEBAS_TERBATAS').slice(0, 20) };
  }
  if (upperKat === 'OBAT_KERAS') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'KERAS').slice(0, 20) };
  }
  if (upperKat === 'SUPLEMEN') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'SUPLEMEN').slice(0, 20) };
  }
  if (upperKat === 'VAKSIN') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'VAKSIN').slice(0, 20) };
  }
  if (upperKat === 'OBAT') {
    return { kategori: 'OBAT', golongan: (cleanGol || 'BEBAS').slice(0, 20) };
  }
  return {
    kategori: (rawKategori || 'OBAT').trim().slice(0, 20),
    golongan: (cleanGol || 'BEBAS').slice(0, 20)
  };
}

export class InventarisRepository {
  static #stokColChecked = false;

  async #ensureStokColumn(): Promise<void> {
    if (InventarisRepository.#stokColChecked) return;
    try {
      await db.query(`
        IF COL_LENGTH('dbo.Obat', 'stok_saat_ini') IS NULL
        BEGIN
          ALTER TABLE dbo.[Obat]
            ADD [stok_saat_ini] INT NOT NULL
            CONSTRAINT [DF_Obat_stok_saat_ini] DEFAULT (0);
        END
      `);
      await db.query(`
        UPDATE o
           SET o.[stok_saat_ini] = ISNULL(agg.total_batch, 0)
          FROM dbo.[Obat] o
          OUTER APPLY (
              SELECT CAST(ISNULL(SUM(sb.jumlah), 0) AS INT) AS total_batch
                FROM dbo.[Batch_Obat] bo
                JOIN dbo.[Stok_Batch] sb ON sb.batch_id = bo.batch_id
               WHERE bo.obat_id = o.obat_id
          ) agg
         WHERE o.[stok_saat_ini] = 0
           AND ISNULL(agg.total_batch, 0) > 0;
      `);
      InventarisRepository.#stokColChecked = true;
    } catch {
      // Abaikan pada mock unit test atau bila user DB read-only
      InventarisRepository.#stokColChecked = true;
    }
  }

  async listObat(limit: number, term: string | null): Promise<Record<string, unknown>[]> {
    await this.#ensureStokColumn();
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) o.obat_id, o.kode, o.nama_generik, o.nama_dagang, o.kategori,
              o.golongan, o.kekuatan, o.bentuk, o.satuan, o.stok_minimum, o.aktif,
              ISNULL(o.stok_saat_ini, ISNULL(SUM(sb.jumlah), 0)) AS stok_saat_ini,
              ISNULL(o.stok_saat_ini, ISNULL(SUM(sb.jumlah), 0)) AS stok_total
         FROM [Obat] o
         LEFT JOIN [Batch_Obat] bo ON bo.obat_id = o.obat_id
         LEFT JOIN [Stok_Batch] sb ON sb.batch_id = bo.batch_id
        WHERE @term IS NULL OR o.nama_generik LIKE @term OR o.nama_dagang LIKE @term OR o.kode LIKE @term
        GROUP BY o.obat_id, o.kode, o.nama_generik, o.nama_dagang, o.kategori,
                 o.golongan, o.kekuatan, o.bentuk, o.satuan, o.stok_minimum, o.stok_saat_ini, o.aktif
        ORDER BY o.nama_generik ASC`,
      { limit, term }
    );
    return result.recordset;
  }

  async findObat(id: string): Promise<string | null> {
    const result = await db.query<{ obat_id: string }>(
      `SELECT TOP 1 obat_id FROM [Obat] WHERE obat_id = @id`,
      { id }
    );
    return result.recordset[0]?.obat_id ?? null;
  }

  async countDuplikatKode(kode: string): Promise<number> {
    const result = await db.query<{ jumlah: number }>(
      `SELECT COUNT(*) AS jumlah FROM [Obat] WHERE kode = @kode`,
      { kode: kode.trim() }
    );
    return result.recordset[0]?.jumlah ?? 0;
  }

  async countDuplikat(namaGenerik: string, kategori: string): Promise<number> {
    const { kategori: normKat } = normalizeKategoriDanGolongan(kategori);
    const result = await db.query<{ jumlah: number }>(
      `SELECT COUNT(*) AS jumlah FROM [Obat] WHERE nama_generik = @nama AND kategori IN (@kategori, @normKat)`,
      { nama: namaGenerik.trim(), kategori: kategori.trim(), normKat }
    );
    return result.recordset[0]?.jumlah ?? 0;
  }

  async createObat(input: ObatBaru): Promise<Record<string, unknown> | undefined> {
    await this.#ensureStokColumn();
    const mapped = normalizeKategoriDanGolongan(input.kategori, input.golongan);
    const stokAwal = Math.max(0, Math.trunc(Number(input.stokSaatIni ?? 0)));

    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Obat]
         (kode, nama_generik, nama_dagang, kategori, bentuk, satuan, kekuatan, golongan, stok_minimum, stok_saat_ini, aktif)
       OUTPUT INSERTED.*
       VALUES (@kode, @nama_generik, @nama_dagang, @kategori, @bentuk, @satuan, @kekuatan, @golongan, @stok_minimum, @stok_saat_ini, 1)`,
      {
        kode: input.kode.trim().slice(0, 30),
        nama_generik: input.namaGenerik.trim().slice(0, 100),
        nama_dagang: (input.namaDagang?.trim() || input.namaGenerik.trim()).slice(0, 100),
        kategori: mapped.kategori,
        bentuk: (input.bentuk.trim() || 'PCS').slice(0, 20),
        satuan: (input.satuan.trim() || 'PCS').slice(0, 20),
        kekuatan: (input.kekuatan?.trim() || '-').slice(0, 50),
        golongan: mapped.golongan,
        stok_minimum: input.stokMinimum,
        stok_saat_ini: stokAwal
      }
    );
    return result.recordset[0];
  }

  async adjustStokSaatIni(obatId: string, delta: number): Promise<void> {
    await this.#ensureStokColumn();
    await db.query(
      `UPDATE [Obat]
          SET stok_saat_ini = CASE WHEN ISNULL(stok_saat_ini, 0) + @delta < 0 THEN 0 ELSE ISNULL(stok_saat_ini, 0) + @delta END
        WHERE obat_id = @id`,
      { id: obatId, delta: Math.trunc(delta) }
    );
  }

  async updateObat(
    id: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown> | undefined> {
    await this.#ensureStokColumn();
    const allowed = ['nama_dagang', 'stok_minimum', 'stok_saat_ini', 'aktif'];
    const keys = Object.keys(values);
    for (const key of keys) {
      if (!allowed.includes(key)) {
        throw new Error(`Kolom obat tidak valid: ${key}`);
      }
    }
    const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Obat] SET ${assignments} OUTPUT INSERTED.* WHERE obat_id = @id`,
      { ...values, id }
    );
    return result.recordset[0];
  }

  async createBatch(input: {
    obatId: string;
    noBatch: string;
    tglKedaluwarsa: string;
    hargaBeli: number;
  }): Promise<string | null> {
    const result = await db.query<{ batch_id: string }>(
      `INSERT INTO [Batch_Obat] (obat_id, no_batch, tgl_kedaluwarsa, harga_beli, tgl_masuk)
       OUTPUT INSERTED.batch_id
       VALUES (@obat_id, @no_batch, @kedaluwarsa, @harga, SYSDATETIME())`,
      {
        obat_id: input.obatId,
        no_batch: input.noBatch,
        kedaluwarsa: input.tglKedaluwarsa,
        harga: input.hargaBeli
      }
    );
    return result.recordset[0]?.batch_id ?? null;
  }

  async findDefaultGudang(): Promise<string> {
    const result = await db.query<{ gudang_id: string }>(
      `SELECT TOP 1 gudang_id FROM [Gudang] ORDER BY (CASE WHEN jenis = 'UTAMA' THEN 1 ELSE 2 END)`
    );
    return result.recordset[0]?.gudang_id ?? '1B398758-84BE-E525-4785-7E975D50FEA7';
  }

  async findOrCreateBatch(obatId: string, noBatch?: string, kedaluwarsa?: string, harga?: number): Promise<string> {
    const existing = await db.query<{ batch_id: string }>(
      `SELECT TOP 1 batch_id FROM [Batch_Obat] WHERE obat_id = @obat_id ORDER BY batch_id DESC`,
      { obat_id: obatId }
    );
    if (existing.recordset[0]?.batch_id) {
      return existing.recordset[0].batch_id;
    }
    const defaultBatch = noBatch || `BATCH-${Date.now().toString().slice(-6)}`;
    const defaultExp = kedaluwarsa || '2028-12-31';
    const defaultHarga = harga ?? 0;
    const inserted = await this.createBatch({
      obatId,
      noBatch: defaultBatch,
      tglKedaluwarsa: defaultExp,
      hargaBeli: defaultHarga
    });
    return inserted ?? '00000000-0000-0000-0000-000000000000';
  }

  async addStok(batchId: string, gudangId: string, jumlah: number): Promise<void> {
    await db.query(
      `IF EXISTS (SELECT 1 FROM [Stok_Batch] WHERE batch_id = @batch_id AND gudang_id = @gudang_id)
       BEGIN
         UPDATE [Stok_Batch]
            SET jumlah = jumlah + @jumlah
          WHERE batch_id = @batch_id AND gudang_id = @gudang_id;
       END
       ELSE
       BEGIN
         INSERT INTO [Stok_Batch] (batch_id, gudang_id, jumlah)
         VALUES (@batch_id, @gudang_id, @jumlah);
       END`,
      { batch_id: batchId, gudang_id: gudangId, jumlah }
    );
  }

  async reduceStok(batchId: string, gudangId: string, jumlah: number, obatId?: string): Promise<void> {
    if (obatId) {
      await db.query(
        `DECLARE @targetBatch UNIQUEIDENTIFIER = (
           SELECT TOP 1 sb.batch_id
             FROM [Stok_Batch] sb
             JOIN [Batch_Obat] bo ON bo.batch_id = sb.batch_id
            WHERE bo.obat_id = @obat_id AND sb.gudang_id = @gudang_id AND sb.jumlah > 0
            ORDER BY bo.tgl_kedaluwarsa ASC
         );
         IF @targetBatch IS NOT NULL
         BEGIN
           UPDATE [Stok_Batch]
              SET jumlah = CASE WHEN jumlah >= @jumlah THEN jumlah - @jumlah ELSE 0 END
            WHERE batch_id = @targetBatch AND gudang_id = @gudang_id;
         END`,
        { obat_id: obatId, gudang_id: gudangId, jumlah }
      );
      return;
    }
    await db.query(
      `UPDATE [Stok_Batch]
          SET jumlah = CASE WHEN jumlah >= @jumlah THEN jumlah - @jumlah ELSE 0 END
        WHERE batch_id = @batch_id AND gudang_id = @gudang_id;`,
      { batch_id: batchId, gudang_id: gudangId, jumlah }
    );
  }

  async insertStok(batchId: string, gudangId: string, jumlah: number): Promise<void> {
    await db.query(
      `INSERT INTO [Stok_Batch] (batch_id, gudang_id, jumlah) VALUES (@batch_id, @gudang_id, @jumlah)`,
      { batch_id: batchId, gudang_id: gudangId, jumlah }
    );
  }

  async addMutasi(input: {
    batchId: string;
    gudangId: string;
    stafId: string | null;
    jumlah: number;
    keterangan: string;
  }): Promise<void> {
    await db.query(
      `DECLARE @sid UNIQUEIDENTIFIER = COALESCE(@staf_id, (SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1));
       IF @sid IS NOT NULL
       BEGIN
         INSERT INTO [Mutasi_Stok] (batch_id, gudang_id, staf_id, jenis, jumlah, waktu, keterangan)
         VALUES (@batch_id, @gudang_id, @sid, 'MASUK', @jumlah, SYSDATETIME(), @keterangan);
       END`,
      {
        batch_id: input.batchId,
        gudang_id: input.gudangId,
        staf_id: input.stafId,
        jumlah: input.jumlah,
        keterangan: input.keterangan
      }
    );
  }

  async addMutasiKeluar(input: {
    batchId: string;
    gudangId: string;
    stafId: string | null;
    jumlah: number;
    keterangan: string;
  }): Promise<void> {
    await db.query(
      `DECLARE @sid UNIQUEIDENTIFIER = COALESCE(@staf_id, (SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1));
       IF @sid IS NOT NULL
       BEGIN
         INSERT INTO [Mutasi_Stok] (batch_id, gudang_id, staf_id, jenis, jumlah, waktu, keterangan)
         VALUES (@batch_id, @gudang_id, @sid, 'KELUAR', @jumlah, SYSDATETIME(), @keterangan);
       END`,
      {
        batch_id: input.batchId,
        gudang_id: input.gudangId,
        staf_id: input.stafId,
        jumlah: input.jumlah,
        keterangan: input.keterangan
      }
    );
  }

  async listRiwayat(obatId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) m.mutasi_id, m.jenis, m.jumlah, m.waktu, m.keterangan,
              bo.no_batch, g.nama AS gudang
         FROM [Mutasi_Stok] m
         JOIN [Batch_Obat] bo ON bo.batch_id = m.batch_id
         LEFT JOIN [Gudang] g ON g.gudang_id = m.gudang_id
        WHERE bo.obat_id = @id
        ORDER BY m.waktu DESC`,
      { id: obatId, limit }
    );
    return result.recordset;
  }

  async listBatch(obatId: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT bo.batch_id, bo.no_batch, bo.tgl_kedaluwarsa, bo.harga_beli,
              ISNULL(SUM(sb.jumlah), 0) AS stok
         FROM [Batch_Obat] bo
         LEFT JOIN [Stok_Batch] sb ON sb.batch_id = bo.batch_id
        WHERE bo.obat_id = @id
        GROUP BY bo.batch_id, bo.no_batch, bo.tgl_kedaluwarsa, bo.harga_beli
        ORDER BY bo.tgl_kedaluwarsa ASC`,
      { id: obatId }
    );
    return result.recordset;
  }

  async listGudang(): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT gudang_id, unit_id, nama, jenis FROM [Gudang] ORDER BY nama ASC`
    );
    return result.recordset;
  }

  async listStokGudang(gudangId: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT sb.batch_id, sb.jumlah, bo.no_batch, bo.tgl_kedaluwarsa,
              o.obat_id, o.kode, o.nama_generik, o.satuan
         FROM [Stok_Batch] sb
         JOIN [Batch_Obat] bo ON bo.batch_id = sb.batch_id
         JOIN [Obat] o ON o.obat_id = bo.obat_id
        WHERE sb.gudang_id = @id
        ORDER BY bo.tgl_kedaluwarsa ASC`,
      { id: gudangId }
    );
    return result.recordset;
  }

  async pengeluaranResep(input: {
    resepId: string;
    gudangId: string;
    stafId: string;
    kunjunganId?: string;
  }): Promise<number> {
    const result = await db.query<{ kode_hasil: number }>(
      `DECLARE @kode INT;
       EXEC [dbo].[sp_pengeluaran_resep_fefo]
            @resep_id = @resep_id, @gudang_id = @gudang_id, @staf_id = @staf_id,
            @kunjungan_id = @kunjungan_id, @kode_hasil = @kode OUTPUT;
       SELECT @kode AS kode_hasil;`,
      {
        resep_id: input.resepId,
        gudang_id: input.gudangId,
        staf_id: input.stafId,
        kunjungan_id: input.kunjunganId ?? null
      }
    );
    return result.recordset[0]?.kode_hasil ?? -1;
  }

  async markResepDiserahkan(resepId: string): Promise<void> {
    await db.query(`UPDATE [Resep] SET status = 'DISERAHKAN' WHERE resep_id = @id`, { id: resepId });
  }
}

export default InventarisRepository;

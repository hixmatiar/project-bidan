import db from '../db/pool';

export interface AsuhanInput {
  bayiId: string;
  stafId: string | null;
  imd: boolean;
  vitK1: boolean;
  salepMata: boolean;
  hb0: boolean;
  keadaanUmum: string;
  catatan?: string;
}

export interface PemeriksaanInput {
  bayiId: string;
  kunjunganId?: string;
  stafId: string | null;
  jenis: string;
  tanggal: string;
  berat?: number;
  panjang?: number;
  lingkarKepala?: number;
  suhu?: number;
  taliPusat?: string;
  menyusu?: string;
  ikterus: boolean;
  tandaBahaya: boolean;
  kontrol?: string;
  catatan?: string;
}

export class BayiRepository {
  async findBayi(id: string): Promise<string | null> {
    const result = await db.query<{ bayi_id: string }>(
      `SELECT TOP 1 bayi_id FROM [Bayi_Lahir] WHERE bayi_id = @id`,
      { id }
    );
    return result.recordset[0]?.bayi_id ?? null;
  }

  async findAsuhan(id: string): Promise<string | null> {
    const result = await db.query<{ asuhan_bbl_id: string }>(
      `SELECT TOP 1 asuhan_bbl_id FROM [Asuhan_BBL] WHERE bayi_id = @id`,
      { id }
    );
    return result.recordset[0]?.asuhan_bbl_id ?? null;
  }

  /** Ambil kunjungan dari persalinan ibu saat pemeriksaan bayi tidak mengirim kunjungan_id. */
  async findKunjunganId(bayiId: string): Promise<string | null> {
    const result = await db.query<{ kunjungan_id: string | null }>(
      `SELECT TOP 1 pr.kunjungan_id
         FROM [Bayi_Lahir] b
         JOIN [Persalinan] pr ON pr.persalinan_id = b.persalinan_id
        WHERE b.bayi_id = @id`,
      { id: bayiId }
    );
    return result.recordset[0]?.kunjungan_id ?? null;
  }

  async createAsuhan(input: AsuhanInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Asuhan_BBL] (bayi_id, staf_id, imd, vit_k1, salep_mata, hb0, keadaan_umum, catatan)
       OUTPUT INSERTED.*
       VALUES (@bayi_id, @staf_id, @imd, @vit_k1, @salep_mata, @hb0, @keadaan_umum, @catatan)`,
      {
        bayi_id: input.bayiId,
        staf_id: input.stafId,
        imd: input.imd,
        vit_k1: input.vitK1,
        salep_mata: input.salepMata,
        hb0: input.hb0,
        keadaan_umum: input.keadaanUmum,
        catatan: input.catatan ?? null
      }
    );
    return result.recordset[0];
  }

  async listAsuhan(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP 100 * FROM [Asuhan_BBL] WHERE bayi_id = @id ORDER BY dicatat_pada DESC`,
      { id }
    );
    return result.recordset;
  }

  async createPemeriksaan(input: PemeriksaanInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Pemeriksaan_Bayi]
         (bayi_id, kunjungan_id, staf_id, jenis, tgl_pemeriksaan, berat_gram, panjang_cm,
          lingkar_kepala_cm, suhu_c, kondisi_tali_pusat, menyusu, ikterus, tanda_bahaya,
          tgl_kontrol_berikutnya, catatan)
       OUTPUT INSERTED.*
       VALUES (@bayi_id, @kunjungan_id, @staf_id, @jenis, @tgl, @berat, @panjang, @lk, @suhu,
               @tali, @menyusu, @ikterus, @bahaya, @kontrol, @catatan)`,
      {
        bayi_id: input.bayiId,
        kunjungan_id: input.kunjunganId ?? null,
        staf_id: input.stafId,
        jenis: input.jenis,
        tgl: input.tanggal,
        berat: input.berat ?? null,
        panjang: input.panjang ?? null,
        lk: input.lingkarKepala ?? null,
        suhu: input.suhu ?? null,
        tali: input.taliPusat ?? null,
        menyusu: input.menyusu ?? null,
        ikterus: input.ikterus,
        bahaya: input.tandaBahaya,
        kontrol: input.kontrol ?? null,
        catatan: input.catatan ?? null
      }
    );
    return result.recordset[0];
  }

  async enqueueKontrol(bayiId: string, kontrol: string): Promise<void> {
    await db.query(
      `INSERT INTO [Notifikasi_Log] (jenis, tujuan, pesan, status, retry_count, waktu_kirim)
       SELECT 'KONTROL_NEONATAL', ISNULL(p.email, '-'),
              'Pengingat kontrol bayi pada ' + CONVERT(VARCHAR(10), @kontrol, 105),
              'ANTRE', 0, DATEADD(DAY, -1, CAST(@kontrol AS DATETIME2))
         FROM [Bayi_Lahir] b
         JOIN [Pasien] p ON p.pasien_id = b.pasien_id
        WHERE b.bayi_id = @bayi_id`,
      { kontrol, bayi_id: bayiId }
    );
  }

  async listPemeriksaan(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [Pemeriksaan_Bayi] WHERE bayi_id = @id ORDER BY tgl_pemeriksaan ASC`,
      { id }
    );
    return result.recordset;
  }

  async grafikTumbuhKembang(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [v_grafik_tumbuh_kembang_bayi] WHERE bayi_id = @id`,
      { id }
    );
    return result.recordset;
  }
}

export default BayiRepository;

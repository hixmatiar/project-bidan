import db from '../db/pool';

const ALERGI_COLUMNS = ['kategori', 'nama', 'keterangan', 'aktif'] as const;

export interface WalkInInput {
  nik: string;
  nama: string;
  jenis_kelamin: string;
  tgl_lahir: string;
  tempat_lahir: string;
  alamat: string;
  no_telepon: string;
  gol_darah: string;
  status_pernikahan: string;
  pekerjaan: string;
  email?: string;
}

export interface AlergiInput {
  obat_id?: string;
  kategori: string;
  nama: string;
  keterangan?: string;
}

export class PasienRepository {
  async searchIdentitas(limit: number, term: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) pasien_id, no_rm, nik, nama, jenis_kelamin, tgl_lahir,
              no_telepon, alamat, email
         FROM [Pasien]
        WHERE @term IS NULL OR nama LIKE @term OR nik LIKE @term OR no_rm LIKE @term
        ORDER BY nama ASC`,
      { limit, term }
    );
    return result.recordset;
  }

  async findByNik(nik: string): Promise<string | null> {
    const result = await db.query<{ pasien_id: string }>(
      `SELECT TOP 1 pasien_id FROM [Pasien] WHERE nik = @nik`,
      { nik }
    );
    return result.recordset[0]?.pasien_id ?? null;
  }

  async createPasien(body: WalkInInput): Promise<string | null> {
    const result = await db.query<{ pasien_id: string }>(
      `INSERT INTO [Pasien]
         (no_rm, nik, nama, jenis_kelamin, tgl_lahir, tempat_lahir, alamat, no_telepon,
          gol_darah, status_pernikahan, pekerjaan, email)
       OUTPUT INSERTED.pasien_id
       VALUES (RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_NoRM AS VARCHAR(10)), 6),
               @nik, @nama, @jenis_kelamin, @tgl_lahir, @tempat_lahir, @alamat, @no_telepon,
               @gol_darah, @status_pernikahan, @pekerjaan, @email)`,
      {
        nik: body.nik,
        nama: body.nama,
        jenis_kelamin: body.jenis_kelamin,
        tgl_lahir: body.tgl_lahir,
        tempat_lahir: body.tempat_lahir,
        alamat: body.alamat,
        no_telepon: body.no_telepon,
        gol_darah: body.gol_darah,
        status_pernikahan: body.status_pernikahan,
        pekerjaan: body.pekerjaan,
        email: body.email ?? null
      }
    );
    return result.recordset[0]?.pasien_id ?? null;
  }

  async findDokterAktif(): Promise<string | null> {
    const result = await db.query<{ staf_id: string }>(
      `SELECT TOP 1 s.staf_id
         FROM [Staf] s
         JOIN [Profesi] pr ON pr.profesi_id = s.profesi_id
        WHERE s.aktif = 1 AND pr.kode LIKE 'DOKTER%'
        ORDER BY s.nama ASC`
    );
    return result.recordset[0]?.staf_id ?? null;
  }

  async findPenjaminPertama(): Promise<string | null> {
    const result = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id FROM [Penjamin] ORDER BY nama ASC`
    );
    return result.recordset[0]?.penjamin_id ?? null;
  }

  async createKunjungan(input: {
    pasienId: string;
    unitId: string;
    dpjpId: string;
    penjaminId: string;
    jenis: string;
  }): Promise<string | null> {
    const result = await db.query<{ kunjungan_id: string }>(
      `INSERT INTO [Kunjungan]
         (pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, tgl_masuk, status)
       OUTPUT INSERTED.kunjungan_id
       VALUES (@pasien_id, @unit_id, @dpjp_staf_id, @penjamin_id, @jenis, SYSDATETIME(), 'MENUNGGU')`,
      {
        pasien_id: input.pasienId,
        unit_id: input.unitId,
        dpjp_staf_id: input.dpjpId,
        penjamin_id: input.penjaminId,
        jenis: input.jenis
      }
    );
    return result.recordset[0]?.kunjungan_id ?? null;
  }

  async syncWalkInReservasiDanTagihan(input: {
    pasienId: string;
    kunjunganId: string;
    layananId?: string;
    jadwalId?: string;
  }): Promise<{ nomor_antrean?: number }> {
    let nomorAntrean: number | undefined;
    try {
      const targetJadwalRes = input.jadwalId
        ? await db.query<{ jadwal_id: string; jam_mulai: string; durasi_per_pasien: number }>(
            `SELECT TOP 1 jadwal_id, CONVERT(VARCHAR(8), jam_mulai, 108) AS jam_mulai, durasi_per_pasien
               FROM [Jadwal_Praktik] WHERE jadwal_id = @jid AND aktif = 1`,
            { jid: input.jadwalId }
          )
        : await db.query<{ jadwal_id: string; jam_mulai: string; durasi_per_pasien: number }>(
            `SELECT TOP 1 jadwal_id, CONVERT(VARCHAR(8), jam_mulai, 108) AS jam_mulai, durasi_per_pasien
               FROM [Jadwal_Praktik]
              WHERE aktif = 1 AND tanggal >= CAST(SYSDATETIME() AS DATE)
              ORDER BY tanggal ASC, jam_mulai ASC`
          );

      const jadwal = targetJadwalRes.recordset[0];
      let targetLayananId = input.layananId ?? null;
      if (!targetLayananId) {
        const layRes = await db.query<{ layanan_id: string }>(
          `SELECT TOP 1 layanan_id FROM [Layanan_Medis] WHERE aktif = 1 ORDER BY nama ASC`
        );
        targetLayananId = layRes.recordset[0]?.layanan_id ?? null;
      }

      if (jadwal?.jadwal_id && targetLayananId) {
        const cntRes = await db.query<{ jml: number }>(
          `SELECT COUNT(*) AS jml FROM [Reservasi]
            WHERE jadwal_id = @jid AND status NOT IN ('BATAL', 'TIDAK_HADIR')`,
          { jid: jadwal.jadwal_id }
        );
        nomorAntrean = (cntRes.recordset[0]?.jml ?? 0) + 1;
        const offset = (nomorAntrean - 1) * (jadwal.durasi_per_pasien || 20);
        await db.query(
          `INSERT INTO [Reservasi]
             (pasien_id, jadwal_id, layanan_id, nomor_antrean, estimasi_jam, status, metode_daftar)
           VALUES (@pid, @jid, @lid, @nomor, DATEADD(MINUTE, @offset, CAST(@jam AS TIME(0))), 'MENUNGGU', 'WALK_IN')`,
          {
            pid: input.pasienId,
            jid: jadwal.jadwal_id,
            lid: targetLayananId,
            nomor: nomorAntrean,
            offset,
            jam: jadwal.jam_mulai || '08:00:00'
          }
        );
      }

      if (targetLayananId) {
        await db.query(
          `DECLARE @tid UNIQUEIDENTIFIER = (SELECT TOP 1 tagihan_id FROM [Tagihan] WHERE kunjungan_id = @kid);
           IF @tid IS NULL
           BEGIN
             DECLARE @tOut TABLE (tagihan_id UNIQUEIDENTIFIER);
             INSERT INTO [Tagihan] (kunjungan_id, total_tagihan, total_dibayar, status, tgl_terbit)
             OUTPUT INSERTED.tagihan_id INTO @tOut
             VALUES (@kid, 0, 0, 'BELUM_LUNAS', SYSDATETIME());
             SELECT TOP 1 @tid = tagihan_id FROM @tOut;
           END
           IF @tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [Tagihan_Rincian] WHERE tagihan_id = @tid AND layanan_id = @lid)
           BEGIN
             DECLARE @hrg DECIMAL(18,2) = ISNULL((
               SELECT TOP 1 harga FROM [Harga_Layanan]
                WHERE layanan_id = @lid
                  AND (berlaku_sampai IS NULL OR berlaku_sampai >= CAST(SYSDATETIME() AS DATE))
                ORDER BY berlaku_dari DESC
             ), 0);
             INSERT INTO [Tagihan_Rincian] (tagihan_id, layanan_id, obat_id, paket_id, qty, harga_satuan, subtotal)
             VALUES (@tid, @lid, NULL, NULL, 1, @hrg, @hrg);
             DECLARE @tot DECIMAL(18,2) = ISNULL((SELECT SUM(subtotal) FROM [Tagihan_Rincian] WHERE tagihan_id = @tid), 0);
             UPDATE [Tagihan] SET total_tagihan = @tot WHERE tagihan_id = @tid;
           END`,
          { kid: input.kunjunganId, lid: targetLayananId }
        );
      }
    } catch {
      // Tetap lanjutkan walk-in meski sinkronisasi opsional gagal
    }
    return { nomor_antrean: nomorAntrean };
  }

  async listPasien(limit: number, term: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) p.pasien_id, p.no_rm, p.nama, p.jenis_kelamin, p.tgl_lahir,
              CASE WHEN EXISTS (SELECT 1 FROM [Alergi_Kondisi] a WHERE a.pasien_id = p.pasien_id AND a.aktif = 1)
                   THEN 1 ELSE 0 END AS red_flag
         FROM [Pasien] p
        WHERE @term IS NULL OR p.nama LIKE @term OR p.nik LIKE @term OR p.no_rm LIKE @term
        ORDER BY p.nama ASC`,
      { limit, term }
    );
    return result.recordset;
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM [Pasien] WHERE pasien_id = @id`,
      { id }
    );
    return result.recordset[0];
  }

  async listAlergi(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP 100 * FROM [Alergi_Kondisi] WHERE pasien_id = @id ORDER BY created_at DESC`,
      { id }
    );
    return result.recordset;
  }

  async listKunjungan(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP 50 * FROM [Kunjungan] WHERE pasien_id = @id ORDER BY tgl_masuk DESC`,
      { id }
    );
    return result.recordset;
  }

  async listKehamilan(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP 100 * FROM [Kehamilan] WHERE pasien_id = @id ORDER BY hpht DESC`,
      { id }
    );
    return result.recordset;
  }

  async createAlergi(
    pasienId: string,
    body: AlergiInput,
    dicatatOleh: string | null
  ): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Alergi_Kondisi] (pasien_id, obat_id, dicatat_oleh, kategori, nama, keterangan, aktif)
       OUTPUT INSERTED.*
       VALUES (@pasien_id, @obat_id, @dicatat_oleh, @kategori, @nama, @keterangan, 1)`,
      {
        pasien_id: pasienId,
        obat_id: body.obat_id ?? null,
        dicatat_oleh: dicatatOleh,
        kategori: body.kategori,
        nama: body.nama,
        keterangan: body.keterangan ?? null
      }
    );
    return result.recordset[0];
  }

  async updateAlergi(
    id: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown> | undefined> {
    const keys = Object.keys(values);
    if (keys.length === 0) {
      return undefined;
    }
    for (const key of keys) {
      if (!ALERGI_COLUMNS.includes(key as (typeof ALERGI_COLUMNS)[number])) {
        throw new Error(`Kolom alergi tidak valid: ${key}`);
      }
    }
    const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Alergi_Kondisi] SET ${assignments} OUTPUT INSERTED.* WHERE alergi_id = @id`,
      { ...values, id }
    );
    return result.recordset[0];
  }

  async createCatatanKeperawatan(input: {
    kunjunganId?: string;
    stafId: string | null;
    isi: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO [Catatan_Keperawatan] (kunjungan_id, staf_id, jenis, isi, waktu)
       VALUES (@kunjungan_id, @staf_id, 'KONFIRMASI_RED_FLAG', @isi, SYSDATETIME())`,
      {
        kunjungan_id: input.kunjunganId,
        staf_id: input.stafId,
        isi: input.isi
      }
    );
  }

  async listKunjunganExport(id: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP 100 k.kunjungan_id, k.tgl_masuk, k.tgl_keluar, k.status,
              (SELECT d.kode_icd + ' - ' + d.nama
                 FROM [Kunjungan_Diagnosa] kd
                 JOIN [Diagnosa] d ON d.diagnosa_id = kd.diagnosa_id
                WHERE kd.kunjungan_id = k.kunjungan_id
                FOR JSON PATH) AS diagnosa
         FROM [Kunjungan] k
        WHERE k.pasien_id = @id
        ORDER BY k.tgl_masuk DESC`,
      { id }
    );
    return result.recordset;
  }
}

export default PasienRepository;

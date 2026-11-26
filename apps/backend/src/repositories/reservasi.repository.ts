import db from '../db/pool';

const JADWAL_COLUMNS = ['jam_mulai', 'jam_selesai', 'kuota_maks', 'durasi_per_pasien', 'aktif'] as const;

export class ReservasiRepository {
  async list(limit: number, tanggal: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) r.reservasi_id, r.pasien_id, p.nama AS nama_pasien, p.nik AS nik_pasien, r.jadwal_id,
              r.layanan_id, l.nama AS nama_layanan,
              r.nomor_antrean, CONVERT(VARCHAR(5), r.estimasi_jam, 108) AS estimasi_jam,
              CONVERT(VARCHAR(5), j.jam_mulai, 108) AS jam_mulai,
              CONVERT(VARCHAR(5), j.jam_selesai, 108) AS jam_selesai,
              r.status, r.metode_daftar, j.tanggal
         FROM [Reservasi] r
         JOIN [Pasien] p ON p.pasien_id = r.pasien_id
         JOIN [Jadwal_Praktik] j ON j.jadwal_id = r.jadwal_id
         LEFT JOIN [Layanan_Medis] l ON l.layanan_id = r.layanan_id
        WHERE @tanggal IS NULL OR CAST(j.tanggal AS VARCHAR(10)) = @tanggal
        ORDER BY j.tanggal DESC, r.nomor_antrean ASC`,
      { limit, tanggal }
    );
    return result.recordset;
  }

  async findJadwal(jadwalId: string): Promise<{ jam_mulai: string } | undefined> {
    const result = await db.query<{ jam_mulai: string }>(
      `SELECT jam_mulai FROM [Jadwal_Praktik] WHERE jadwal_id = @id AND aktif = 1`,
      { id: jadwalId }
    );
    return result.recordset[0];
  }

  async reschedule(
    id: string,
    input: { jadwalId: string; nomor?: number; jam?: string }
  ): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Reservasi]
          SET jadwal_id = @jadwal_id,
              nomor_antrean = ISNULL(@nomor, nomor_antrean),
              estimasi_jam = ISNULL(@jam, estimasi_jam),
              status = 'MENUNGGU'
        OUTPUT INSERTED.*
        WHERE reservasi_id = @id`,
      {
        id,
        jadwal_id: input.jadwalId,
        nomor: input.nomor ?? null,
        jam: input.jam ?? null
      }
    );
    return result.recordset[0];
  }

  async cancel(id: string): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Reservasi] SET status = 'BATAL' OUTPUT INSERTED.* WHERE reservasi_id = @id`,
      { id }
    );
    return result.recordset[0];
  }

  async updateStatus(id: string, status: string): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Reservasi] SET status = @status OUTPUT INSERTED.* WHERE reservasi_id = @id`,
      { id, status }
    );
    const updated = result.recordset[0];
    if (updated && status === 'SELESAI') {
      try {
        await db.query(
          `DECLARE @pid UNIQUEIDENTIFIER = (SELECT TOP 1 pasien_id FROM [Reservasi] WHERE reservasi_id = @id);
           DECLARE @lid UNIQUEIDENTIFIER = (SELECT TOP 1 layanan_id FROM [Reservasi] WHERE reservasi_id = @id);
           DECLARE @jid UNIQUEIDENTIFIER = (SELECT TOP 1 jadwal_id FROM [Reservasi] WHERE reservasi_id = @id);
           IF @pid IS NOT NULL
           BEGIN
             DECLARE @kid UNIQUEIDENTIFIER = (
               SELECT TOP 1 kunjungan_id FROM [Kunjungan]
                WHERE pasien_id = @pid AND status != 'BATAL'
                ORDER BY tgl_masuk DESC
             );
             IF @kid IS NULL
             BEGIN
               DECLARE @uid UNIQUEIDENTIFIER = (SELECT TOP 1 unit_id FROM [Jadwal_Praktik] WHERE jadwal_id = @jid);
               IF @uid IS NULL SET @uid = (SELECT TOP 1 unit_id FROM [Unit_Pelayanan] WHERE aktif = 1);
               DECLARE @sid UNIQUEIDENTIFIER = (SELECT TOP 1 staf_id FROM [Jadwal_Praktik] WHERE jadwal_id = @jid);
               IF @sid IS NULL SET @sid = (SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1);
               DECLARE @penid UNIQUEIDENTIFIER = (SELECT TOP 1 penjamin_id FROM [Penjamin] WHERE aktif = 1 ORDER BY CASE WHEN jenis = 'MANDIRI' THEN 0 ELSE 1 END, nama ASC);
               IF @uid IS NOT NULL AND @sid IS NOT NULL AND @penid IS NOT NULL
               BEGIN
                 DECLARE @kOut TABLE (kunjungan_id UNIQUEIDENTIFIER);
                 INSERT INTO [Kunjungan] (pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, status, tgl_masuk)
                 OUTPUT INSERTED.kunjungan_id INTO @kOut
                 VALUES (@pid, @uid, @sid, @penid, 'RAWAT_JALAN', 'SELESAI', SYSDATETIME());
                 SELECT TOP 1 @kid = kunjungan_id FROM @kOut;
               END
             END
             ELSE
             BEGIN
               UPDATE [Kunjungan] SET status = 'SELESAI' WHERE kunjungan_id = @kid;
             END

             IF @kid IS NOT NULL AND @lid IS NOT NULL
             BEGIN
               DECLARE @tid UNIQUEIDENTIFIER = (SELECT TOP 1 tagihan_id FROM [Tagihan] WHERE kunjungan_id = @kid);
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
                 UPDATE [Tagihan]
                    SET total_tagihan = @tot,
                        status = CASE WHEN total_dibayar >= @tot AND @tot > 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END
                  WHERE tagihan_id = @tid;
               END
             END
           END`,
          { id }
        );
      } catch {
        // Abaikan jika sinkronisasi tagihan otomatis gagal
      }
    }
    return updated;
  }

  async listJadwal(limit: number, tanggal: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) j.jadwal_id, j.staf_id, j.unit_id, j.ruangan_id, j.tanggal,
              CONVERT(VARCHAR(5), j.jam_mulai, 108) AS jam_mulai,
              CONVERT(VARCHAR(5), j.jam_selesai, 108) AS jam_selesai,
              j.kuota_maks, j.durasi_per_pasien, j.aktif
         FROM [Jadwal_Praktik] j
        WHERE j.aktif = 1 AND (@tanggal IS NULL OR CAST(j.tanggal AS VARCHAR(10)) = @tanggal)
        ORDER BY j.tanggal ASC, j.jam_mulai ASC`,
      { limit, tanggal }
    );
    return result.recordset;
  }

  async createJadwal(input: {
    stafId: string;
    unitId: string;
    ruanganId: string;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    kuotaMaks: number;
    durasi: number;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Jadwal_Praktik]
         (staf_id, unit_id, ruangan_id, tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien, aktif)
       OUTPUT INSERTED.*
       VALUES (@staf_id, @unit_id, @ruangan_id, @tanggal, @jam_mulai, @jam_selesai, @kuota_maks, @durasi, 1)`,
      {
        staf_id: input.stafId,
        unit_id: input.unitId,
        ruangan_id: input.ruanganId,
        tanggal: input.tanggal,
        jam_mulai: input.jamMulai,
        jam_selesai: input.jamSelesai,
        kuota_maks: input.kuotaMaks,
        durasi: input.durasi
      }
    );
    return result.recordset[0];
  }

  async updateJadwal(
    id: string,
    values: Record<string, unknown>
  ): Promise<Record<string, unknown> | undefined> {
    const keys = Object.keys(values);
    for (const key of keys) {
      if (!JADWAL_COLUMNS.includes(key as (typeof JADWAL_COLUMNS)[number])) {
        throw new Error(`Kolom jadwal tidak valid: ${key}`);
      }
    }
    const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
    const result = await db.query<Record<string, unknown>>(
      `UPDATE [Jadwal_Praktik] SET ${assignments} OUTPUT INSERTED.* WHERE jadwal_id = @id`,
      { ...values, id }
    );
    return result.recordset[0];
  }
}

export default ReservasiRepository;

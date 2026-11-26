import db from '../db/pool';

export interface PasienRingkas {
  pasien_id: string;
  no_rm: string;
  nama: string;
}

export interface JadwalSlot {
  jam_mulai: string;
  durasi_per_pasien: number;
  kuota_maks: number;
}

export class PublicRepository {
  async listKonten(limit: number, tipe: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) konten_id, tipe, judul, isi, media_url, urutan, updated_at
         FROM [Konten_Publik]
        WHERE terbit = 1 AND (@tipe IS NULL OR tipe = @tipe)
        ORDER BY urutan ASC`,
      { limit, tipe }
    );
    return result.recordset;
  }

  async listLayanan(limit: number, unitId: string | null): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit)
              l.layanan_id, l.unit_id, l.kode, l.nama, l.kategori, l.satuan, l.kode_icd9,
              ISNULL(hl.harga, 0) AS harga
         FROM [Layanan_Medis] l
         OUTER APPLY (
           SELECT TOP 1 harga
             FROM [Harga_Layanan] h
            WHERE h.layanan_id = l.layanan_id
              AND (h.berlaku_sampai IS NULL OR h.berlaku_sampai >= CAST(SYSDATETIME() AS DATE))
            ORDER BY h.berlaku_dari DESC
         ) hl
        WHERE l.aktif = 1 AND (@unit_id IS NULL OR l.unit_id = @unit_id)
        ORDER BY l.nama ASC`,
      { limit, unit_id: unitId }
    );
    return result.recordset;
  }

  async listJadwal(limit: number, unitId: string | null): Promise<Record<string, unknown>[]> {
    const queryStr = `SELECT TOP (@limit) j.jadwal_id, j.staf_id, j.unit_id, j.ruangan_id, j.tanggal,
              CONVERT(VARCHAR(5), j.jam_mulai, 108) AS jam_mulai,
              CONVERT(VARCHAR(5), j.jam_selesai, 108) AS jam_selesai,
              j.kuota_maks, j.durasi_per_pasien,
              ISNULL((
                SELECT COUNT(*) FROM [Reservasi] r
                 WHERE r.jadwal_id = j.jadwal_id
                   AND r.status NOT IN ('BATAL', 'TIDAK_HADIR')
              ), 0) AS kuota_terisi,
              CASE WHEN j.kuota_maks - ISNULL((
                     SELECT COUNT(*) FROM [Reservasi] r
                      WHERE r.jadwal_id = j.jadwal_id
                        AND r.status NOT IN ('BATAL', 'TIDAK_HADIR')
                   ), 0) < 0 THEN 0
                   ELSE j.kuota_maks - ISNULL((
                     SELECT COUNT(*) FROM [Reservasi] r
                      WHERE r.jadwal_id = j.jadwal_id
                        AND r.status NOT IN ('BATAL', 'TIDAK_HADIR')
                   ), 0)
              END AS sisa_kuota
         FROM [Jadwal_Praktik] j
        WHERE j.aktif = 1 AND j.tanggal >= CAST(SYSDATETIME() AS DATE)
          AND (@unit_id IS NULL OR j.unit_id = @unit_id)
        ORDER BY j.tanggal ASC, j.jam_mulai ASC`;

    let result = await db.query<Record<string, unknown>>(queryStr, { limit, unit_id: unitId });
    if (result.recordset.length === 0) {
      // Auto-injeksi jadwal praktik default (Sesi Pagi & Sore) jika database belum memiliki jadwal aktif
      await db.query(`
        IF NOT EXISTS (SELECT 1 FROM [Jadwal_Praktik] WHERE aktif = 1 AND tanggal >= CAST(SYSDATETIME() AS DATE))
        BEGIN
          DECLARE @sid UNIQUEIDENTIFIER = (SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1);
          DECLARE @uid UNIQUEIDENTIFIER = (SELECT TOP 1 unit_id FROM [Unit_Pelayanan] WHERE aktif = 1);
          DECLARE @rid UNIQUEIDENTIFIER = (SELECT TOP 1 ruangan_id FROM [Ruangan] WHERE aktif = 1);
          IF @sid IS NOT NULL AND @uid IS NOT NULL AND @rid IS NOT NULL
          BEGIN
            INSERT INTO [Jadwal_Praktik] (jadwal_id, staf_id, unit_id, ruangan_id, tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien, aktif)
            VALUES 
              (NEWID(), @sid, @uid, @rid, CAST(SYSDATETIME() AS DATE), '08:00:00', '12:00:00', 15, 20, 1),
              (NEWID(), @sid, @uid, @rid, CAST(SYSDATETIME() AS DATE), '16:00:00', '20:00:00', 15, 20, 1),
              (NEWID(), @sid, @uid, @rid, DATEADD(DAY, 1, CAST(SYSDATETIME() AS DATE)), '08:00:00', '12:00:00', 15, 20, 1),
              (NEWID(), @sid, @uid, @rid, DATEADD(DAY, 1, CAST(SYSDATETIME() AS DATE)), '16:00:00', '20:00:00', 15, 20, 1);
          END
        END
      `);
      result = await db.query<Record<string, unknown>>(queryStr, { limit, unit_id: unitId });
    }
    return result.recordset;
  }

  async findPasien(nik: string | null, noRm: string | null): Promise<PasienRingkas | undefined> {
    const result = await db.query<PasienRingkas>(
      `SELECT TOP 1 pasien_id, no_rm, nama FROM [Pasien]
        WHERE nik = @nik OR no_rm = @no_rm`,
      { nik, no_rm: noRm }
    );
    return result.recordset[0];
  }

  async findJadwalSlot(jadwalId: string): Promise<JadwalSlot | undefined> {
    const result = await db.query<JadwalSlot>(
      `SELECT jam_mulai, durasi_per_pasien, kuota_maks FROM [Jadwal_Praktik]
        WHERE jadwal_id = @id AND aktif = 1 AND tanggal >= CAST(SYSDATETIME() AS DATE)`,
      { id: jadwalId }
    );
    return result.recordset[0];
  }

  async countReservasi(jadwalId: string): Promise<number> {
    const result = await db.query<{ jumlah: number }>(
      `SELECT COUNT(*) AS jumlah FROM [Reservasi]
        WHERE jadwal_id = @id AND status NOT IN ('BATAL', 'TIDAK_HADIR')`,
      { id: jadwalId }
    );
    return result.recordset[0]?.jumlah ?? 0;
  }

  async createReservasi(input: {
    pasienId: string;
    jadwalId: string;
    layananId: string;
    nomor: number;
    offset: number;
    jam: string;
    metode: string;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Reservasi]
         (pasien_id, jadwal_id, layanan_id, nomor_antrean, estimasi_jam, status, metode_daftar)
       OUTPUT INSERTED.reservasi_id, INSERTED.nomor_antrean, INSERTED.estimasi_jam
       VALUES (@pasien_id, @jadwal_id, @layanan_id, @nomor,
               DATEADD(MINUTE, @offset, CAST(@jam AS TIME(0))), 'MENUNGGU', @metode)`,
      {
        pasien_id: input.pasienId,
        jadwal_id: input.jadwalId,
        layanan_id: input.layananId,
        nomor: input.nomor,
        offset: input.offset,
        jam: input.jam,
        metode: input.metode
      }
    );

    // Otomatis buat draf Kunjungan & Tagihan awal berdasarkan layanan_id yang dipilih pasien saat reservasi
    try {
      await db.query(
        `DECLARE @kid UNIQUEIDENTIFIER = (
           SELECT TOP 1 kunjungan_id FROM [Kunjungan]
            WHERE pasien_id = @pasien_id
              AND CAST(tgl_masuk AS DATE) = CAST(SYSDATETIME() AS DATE)
              AND status != 'BATAL'
            ORDER BY tgl_masuk DESC
         );
         IF @kid IS NULL
         BEGIN
           DECLARE @uid UNIQUEIDENTIFIER = (SELECT TOP 1 unit_id FROM [Jadwal_Praktik] WHERE jadwal_id = @jadwal_id);
           IF @uid IS NULL SET @uid = (SELECT TOP 1 unit_id FROM [Unit_Pelayanan] WHERE aktif = 1);
           DECLARE @sid UNIQUEIDENTIFIER = (SELECT TOP 1 staf_id FROM [Jadwal_Praktik] WHERE jadwal_id = @jadwal_id);
           IF @sid IS NULL SET @sid = (SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1);
           DECLARE @penid UNIQUEIDENTIFIER = (SELECT TOP 1 penjamin_id FROM [Penjamin] WHERE aktif = 1 ORDER BY CASE WHEN jenis = 'MANDIRI' THEN 0 ELSE 1 END, nama ASC);
           IF @uid IS NOT NULL AND @sid IS NOT NULL AND @penid IS NOT NULL
           BEGIN
             DECLARE @kOut TABLE (kunjungan_id UNIQUEIDENTIFIER);
             INSERT INTO [Kunjungan] (pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, status, tgl_masuk)
             OUTPUT INSERTED.kunjungan_id INTO @kOut
             VALUES (@pasien_id, @uid, @sid, @penid, 'RAWAT_JALAN', 'MENUNGGU', SYSDATETIME());
             SELECT TOP 1 @kid = kunjungan_id FROM @kOut;
           END
         END

         IF @kid IS NOT NULL AND @layanan_id IS NOT NULL
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

           IF @tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [Tagihan_Rincian] WHERE tagihan_id = @tid AND layanan_id = @layanan_id)
           BEGIN
             DECLARE @hrg DECIMAL(18,2) = ISNULL((
               SELECT TOP 1 harga FROM [Harga_Layanan]
                WHERE layanan_id = @layanan_id
                  AND (berlaku_sampai IS NULL OR berlaku_sampai >= CAST(SYSDATETIME() AS DATE))
                ORDER BY berlaku_dari DESC
             ), 0);
             INSERT INTO [Tagihan_Rincian] (tagihan_id, layanan_id, obat_id, paket_id, qty, harga_satuan, subtotal)
             VALUES (@tid, @layanan_id, NULL, NULL, 1, @hrg, @hrg);

             DECLARE @tot DECIMAL(18,2) = ISNULL((SELECT SUM(subtotal) FROM [Tagihan_Rincian] WHERE tagihan_id = @tid), 0);
             UPDATE [Tagihan]
                SET total_tagihan = @tot,
                    status = CASE WHEN total_dibayar >= @tot AND @tot > 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END
              WHERE tagihan_id = @tid;
           END
         END`,
        {
          pasien_id: input.pasienId,
          jadwal_id: input.jadwalId,
          layanan_id: input.layananId
        }
      );
    } catch {
      // Lanjutkan pengembalian tiket reservasi bila auto-tagihan awal gagal
    }

    return result.recordset[0];
  }

  async createPasienRingkas(input: {
    nik: string;
    nama?: string;
    noHp?: string;
    email?: string;
    jenisKelamin?: 'P' | 'L';
  }): Promise<string | undefined> {
    const result = await db.query<{ pasien_id: string }>(
      `INSERT INTO [Pasien]
         (no_rm, nik, nama, jenis_kelamin, tgl_lahir, tempat_lahir, alamat, no_telepon,
          gol_darah, status_pernikahan, pekerjaan, email)
       OUTPUT INSERTED.pasien_id
       VALUES (RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_NoRM AS VARCHAR(10)), 6),
               @nik, @nama, @jenis_kelamin, '1995-01-01', 'Jambi', 'Kota Jambi', @no_telepon,
               'O', 'MENIKAH', 'Ibu Rumah Tangga', @email)`,
      {
        nik: input.nik,
        nama: input.nama || 'Pasien Umum',
        jenis_kelamin: input.jenisKelamin === 'L' ? 'L' : 'P',
        no_telepon: input.noHp || '081234567890',
        email: input.email || null
      }
    );
    return result.recordset[0]?.pasien_id;
  }
}

export default PublicRepository;

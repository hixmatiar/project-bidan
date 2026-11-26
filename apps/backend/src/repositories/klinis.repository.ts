import db from '../db/pool';

export interface KunjunganInput {
  pasienId: string;
  unitId: string;
  dpjpId: string;
  penjaminId: string;
  jenis: string;
}

export interface KehamilanInput {
  hpht: string;
  gravida: number;
  paritas: number;
  abortus: number;
  statusRisiko: string;
  status: string;
}

export interface AncInput {
  kunjunganKe: number;
  minggu: number;
  tinggiFundus?: number;
  djj?: number;
  letakJanin?: string;
  tabletFe: boolean;
}

export interface PersalinanInput {
  kehamilanId: string;
  kunjunganId?: string;
  penolongId: string | null;
  waktu?: string;
  jenis: string;
  komplikasi?: string;
  kondisiIbu: string;
}

export interface BayiInput {
  persalinanId: string;
  berat: number;
  panjang: number;
  apgar1?: number;
  apgar5?: number;
  kondisi: string;
  nama: string;
  jenisKelamin: string;
  tglLahir: string;
  ibuPasienId: string;
}

export interface ImunisasiInput {
  pasienId: string;
  vaksinId: string;
  kunjunganId?: string;
  batchId?: string;
  stafId: string | null;
  dosisKe: number;
  tanggal: string;
}

export interface KbInput {
  pasienId: string;
  metodeId: string;
  kunjunganId?: string;
  tanggal: string;
  kontrolBerikutnya?: string;
  efekSamping?: string;
}

export class KlinisRepository {
  async findDokterAktif(): Promise<string | null> {
    const result = await db.query<{ staf_id: string }>(
      `SELECT TOP 1 s.staf_id FROM [Staf] s JOIN [Profesi] pr ON pr.profesi_id = s.profesi_id
        WHERE s.aktif = 1 AND pr.kode LIKE 'DOKTER%' ORDER BY s.nama ASC`
    );
    return result.recordset[0]?.staf_id ?? null;
  }

  async findPenjaminPertama(): Promise<string | null> {
    const result = await db.query<{ penjamin_id: string }>(
      `SELECT TOP 1 penjamin_id FROM [Penjamin] ORDER BY nama ASC`
    );
    return result.recordset[0]?.penjamin_id ?? null;
  }

  async createKunjungan(input: KunjunganInput): Promise<string | null> {
    const result = await db.query<{ kunjungan_id: string }>(
      `INSERT INTO [Kunjungan]
         (pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, status, tgl_masuk)
       OUTPUT INSERTED.kunjungan_id
       VALUES (@pasien_id, @unit_id, @dpjp, @penjamin, @jenis, 'DILAYANI', SYSDATETIME())`,
      {
        pasien_id: input.pasienId,
        unit_id: input.unitId,
        dpjp: input.dpjpId,
        penjamin: input.penjaminId,
        jenis: input.jenis
      }
    );
    return result.recordset[0]?.kunjungan_id ?? null;
  }

  async upsertDiagnosa(kunjunganId: string, kode: string, nama: string, jenis: string): Promise<void> {
    await db.query(
      `IF NOT EXISTS (SELECT 1 FROM [Diagnosa] WHERE kode_icd = @kode)
         INSERT INTO [Diagnosa] (kode_icd, nama) VALUES (@kode, @nama);
       INSERT INTO [Kunjungan_Diagnosa] (kunjungan_id, diagnosa_id, jenis)
       SELECT TOP 1 @k, diagnosa_id, @j FROM [Diagnosa] WHERE kode_icd = @kode;`,
      { kode, nama, k: kunjunganId, j: jenis }
    );
  }

  async insertTindakan(kunjunganId: string, layananIds: string[], stafId: string): Promise<void> {
    const params: Record<string, unknown> = { k: kunjunganId, s: stafId };
    const rows = layananIds.map((id, index) => {
      params[`l${index}`] = id;
      return `(@k, @l${index}, @s, 1, SYSDATETIME())`;
    });
    await db.query(
      `INSERT INTO [Tindakan_Kunjungan] (kunjungan_id, layanan_id, staf_id, qty, waktu)
       VALUES ${rows.join(', ')}`,
      params
    );
  }

  async createCatatan(input: {
    kunjunganId: string;
    stafId: string | null;
    jenis: string;
    isi: string;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Catatan_Keperawatan] (kunjungan_id, staf_id, jenis, isi, waktu)
       OUTPUT INSERTED.*
       VALUES (@kunjungan_id, @staf_id, @jenis, @isi, SYSDATETIME())`,
      {
        kunjungan_id: input.kunjunganId,
        staf_id: input.stafId,
        jenis: input.jenis,
        isi: input.isi
      }
    );
    return result.recordset[0];
  }

  async listKehamilan(pasienId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) * FROM [Kehamilan] WHERE pasien_id = @id ORDER BY hpht DESC`,
      { id: pasienId, limit }
    );
    return result.recordset;
  }

  async createKehamilan(pasienId: string, input: KehamilanInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Kehamilan] (pasien_id, hpht, hpl, gravida, paritas, abortus, status_risiko, status)
       OUTPUT INSERTED.*
       VALUES (@pasien_id, @hpht, DATEADD(DAY, 280, CAST(@hpht AS DATE)), @g, @p, @a, @risiko, @status)`,
      {
        pasien_id: pasienId,
        hpht: input.hpht,
        g: input.gravida,
        p: input.paritas,
        a: input.abortus,
        risiko: input.statusRisiko,
        status: input.status
      }
    );
    return result.recordset[0];
  }

  async listAnc(kehamilanId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) * FROM [Pemeriksaan_ANC] WHERE kehamilan_id = @id ORDER BY kunjungan_ke DESC`,
      { id: kehamilanId, limit }
    );
    return result.recordset;
  }

  async createAnc(kehamilanId: string, input: AncInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Pemeriksaan_ANC]
         (pemeriksaan_id, kehamilan_id, kunjungan_ke, usia_kehamilan_minggu, tinggi_fundus, djj, letak_janin, tablet_fe_diberikan)
       OUTPUT INSERTED.*
       VALUES (NEWID(), @kehamilan_id, @ke, @minggu, @tf, @djj, @letak, @fe)`,
      {
        kehamilan_id: kehamilanId,
        ke: input.kunjunganKe,
        minggu: input.minggu,
        tf: input.tinggiFundus ?? null,
        djj: input.djj ?? null,
        letak: input.letakJanin ?? null,
        fe: input.tabletFe
      }
    );
    return result.recordset[0];
  }

  async createPersalinan(input: PersalinanInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Persalinan]
         (kehamilan_id, kunjungan_id, penolong_staf_id, waktu_persalinan, jenis_persalinan, komplikasi, kondisi_ibu)
       OUTPUT INSERTED.*
       VALUES (@kehamilan_id, @kunjungan_id, @penolong, ISNULL(CAST(@waktu AS DATETIME2), SYSDATETIME()), @jenis, @komplikasi, @kondisi)`,
      {
        kehamilan_id: input.kehamilanId,
        kunjungan_id: input.kunjunganId ?? null,
        penolong: input.penolongId,
        waktu: input.waktu ?? null,
        jenis: input.jenis,
        komplikasi: input.komplikasi ?? null,
        kondisi: input.kondisiIbu
      }
    );
    return result.recordset[0];
  }

  async completeKehamilan(kehamilanId: string): Promise<void> {
    await db.query(`UPDATE [Kehamilan] SET status = 'SELESAI' WHERE kehamilan_id = @id`, {
      id: kehamilanId
    });
  }

  async createPasienBayi(input: {
    nama: string;
    jenisKelamin: string;
    tglLahir: string;
    ibuPasienId: string;
  }): Promise<string | null> {
    const result = await db.query<{ pasien_id: string }>(
      `INSERT INTO [Pasien]
         (no_rm, nik, nama, jenis_kelamin, tgl_lahir, tempat_lahir, alamat, no_telepon,
          gol_darah, status_pernikahan, pekerjaan, ibu_pasien_id)
       OUTPUT INSERTED.pasien_id
       VALUES (RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_NoRM AS VARCHAR(10)), 6),
               @nik, @nama, @jk, @tgl, '-', '-', '-', '-', 'BELUM_MENIKAH', '-', @ibu)`,
      {
        nik: `B${Date.now()}`.slice(0, 16).padEnd(16, '0'),
        nama: input.nama,
        jk: input.jenisKelamin,
        tgl: input.tglLahir,
        ibu: input.ibuPasienId
      }
    );
    return result.recordset[0]?.pasien_id ?? null;
  }

  async createBayiLahir(input: BayiInput, pasienId: string): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Bayi_Lahir]
         (persalinan_id, pasien_id, berat_lahir_gram, panjang_lahir_cm, apgar_1, apgar_5, kondisi)
       OUTPUT INSERTED.*
       VALUES (@persalinan_id, @pasien_id, @berat, @panjang, @apgar1, @apgar5, @kondisi)`,
      {
        persalinan_id: input.persalinanId,
        pasien_id: pasienId,
        berat: input.berat,
        panjang: input.panjang,
        apgar1: input.apgar1 ?? null,
        apgar5: input.apgar5 ?? null,
        kondisi: input.kondisi
      }
    );
    return result.recordset[0];
  }

  async listImunisasi(pasienId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) i.*, v.nama AS nama_vaksin
         FROM [Imunisasi_Pasien] i
         LEFT JOIN [Vaksin] v ON v.vaksin_id = i.vaksin_id
        WHERE i.pasien_id = @id
        ORDER BY i.tanggal DESC`,
      { id: pasienId, limit }
    );
    return result.recordset;
  }

  async createImunisasi(input: ImunisasiInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Imunisasi_Pasien] (pasien_id, vaksin_id, kunjungan_id, batch_id, staf_id, dosis_ke, tanggal)
       OUTPUT INSERTED.*
       VALUES (@pasien_id, @vaksin, @kunjungan, @batch, @staf, @dosis, @tanggal)`,
      {
        pasien_id: input.pasienId,
        vaksin: input.vaksinId,
        kunjungan: input.kunjunganId ?? null,
        batch: input.batchId ?? null,
        staf: input.stafId,
        dosis: input.dosisKe,
        tanggal: input.tanggal
      }
    );
    return result.recordset[0];
  }

  async listKb(pasienId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit) kb.*, m.nama AS metode
         FROM [Pelayanan_KB] kb
         LEFT JOIN [Metode_KB] m ON m.metode_id = kb.metode_id
        WHERE kb.pasien_id = @id
        ORDER BY kb.tanggal DESC`,
      { id: pasienId, limit }
    );
    return result.recordset;
  }

  async createKb(input: KbInput): Promise<Record<string, unknown> | undefined> {
    const result = await db.query<Record<string, unknown>>(
      `INSERT INTO [Pelayanan_KB] (pasien_id, metode_id, kunjungan_id, tanggal, kontrol_berikutnya, efek_samping)
       OUTPUT INSERTED.*
       VALUES (@pasien_id, @metode, @kunjungan, @tanggal, @kontrol, @efek)`,
      {
        pasien_id: input.pasienId,
        metode: input.metodeId,
        kunjungan: input.kunjunganId ?? null,
        tanggal: input.tanggal,
        kontrol: input.kontrolBerikutnya ?? null,
        efek: input.efekSamping ?? null
      }
    );
    return result.recordset[0];
  }

  async simpanRme(input: {
    pasien_id: string;
    kunjungan_id?: string;
    staf_id?: string;
    keluhan: string;
    pemeriksaan_fisik?: string;
    asesmen?: string;
    rencana?: string;
    catatan_bebas?: string;
    sistolik?: number;
    diastolik?: number;
    nadi?: number;
    suhu?: number;
    berat_badan?: number;
    tinggi_badan?: number;
    djj?: number;
    tinggi_fundus?: number;
    usia_kehamilan?: string;
    diagnosa?: string;
    kode_icd10?: string;
    tindakan_resep?: string;
    protokol_tambahan?: string;
    catatan_edukasi?: string;
    tgl_kontrol_ulang?: string;
    layanan_id?: string;
    resep_obat?: Array<{ obat_id: string; qty: number; harga_satuan?: number }>;
    stafId: string | null;
  }): Promise<Record<string, unknown>> {
    let kunjunganId = input.kunjungan_id;
    if (!kunjunganId) {
      const existingKunjungan = await db.query<{ kunjungan_id: string }>(
        `SELECT TOP 1 kunjungan_id FROM [Kunjungan]
          WHERE pasien_id = @pasien_id AND status != 'BATAL'
          ORDER BY tgl_masuk DESC`,
        { pasien_id: input.pasien_id }
      );
      if (existingKunjungan.recordset[0]?.kunjungan_id) {
        kunjunganId = existingKunjungan.recordset[0].kunjungan_id;
        await db.query(`UPDATE [Kunjungan] SET status = 'SELESAI' WHERE kunjungan_id = @kid`, {
          kid: kunjunganId
        });
      } else {
        const uidRow = await db.query<{ unit_id: string }>(`SELECT TOP 1 unit_id FROM [Unit_Pelayanan] WHERE aktif = 1`);
        const sidRow = await db.query<{ staf_id: string }>(`SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1`);
        const penRow = await db.query<{ penjamin_id: string }>(`SELECT TOP 1 penjamin_id FROM [Penjamin] WHERE aktif = 1`);
        const createdK = await db.query<{ kunjungan_id: string }>(
          `INSERT INTO [Kunjungan] (kunjungan_id, pasien_id, unit_id, dpjp_staf_id, penjamin_id, jenis_kunjungan, tgl_masuk, status)
           OUTPUT INSERTED.kunjungan_id
           VALUES (NEWID(), @pid, @uid, @sid, @penid, 'RAWAT_JALAN', CAST(SYSDATETIME() AS DATE), 'SELESAI')`,
          {
            pid: input.pasien_id,
            uid: uidRow.recordset[0]?.unit_id,
            sid: input.stafId ?? sidRow.recordset[0]?.staf_id,
            penid: penRow.recordset[0]?.penjamin_id
          }
        );
        kunjunganId = createdK.recordset[0]?.kunjungan_id;
      }
    }

    const sidDefault = (await db.query<{ staf_id: string }>(`SELECT TOP 1 staf_id FROM [Staf] WHERE aktif = 1`)).recordset[0]?.staf_id;
    const effectiveStafId = input.stafId ?? sidDefault;

    const pemRes = await db.query<{ pemeriksaan_id: string }>(
      `INSERT INTO [Pemeriksaan] (pemeriksaan_id, kunjungan_id, staf_id, keluhan, pemeriksaan_fisik, asesmen, rencana, catatan_bebas, waktu)
       OUTPUT INSERTED.pemeriksaan_id
       VALUES (NEWID(), @kid, @sid, @keluhan, @fisik, @asesmen, @rencana, @catatan, SYSDATETIME())`,
      {
        kid: kunjunganId,
        sid: effectiveStafId,
        keluhan: input.keluhan,
        fisik: input.pemeriksaan_fisik || 'Dalam batas normal',
        asesmen: input.asesmen || input.diagnosa || 'Pemeriksaan Klinis Kebidanan',
        rencana: input.rencana || input.tindakan_resep || 'Konseling Asuhan Kebidanan',
        catatan: [input.protokol_tambahan, input.catatan_edukasi, input.catatan_bebas].filter(Boolean).join(' | ')
      }
    );
    const pemeriksaanId = pemRes.recordset[0]?.pemeriksaan_id;

    if (pemeriksaanId) {
      await db.query(
        `INSERT INTO [Tanda_Vital] (vital_id, pemeriksaan_id, sistolik, diastolik, nadi, suhu, frekuensi_napas, spo2, berat_badan, tinggi_badan, waktu)
         VALUES (NEWID(), @pemId, @sis, @dia, @nadi, @suhu, 20, 98, @bb, @tb, SYSDATETIME())`,
        {
          pemId: pemeriksaanId,
          sis: input.sistolik ?? 120,
          dia: input.diastolik ?? 80,
          nadi: input.nadi ?? 80,
          suhu: input.suhu ?? 36.5,
          bb: input.berat_badan ?? 55,
          tb: input.tinggi_badan ?? 155
        }
      );
    }

    const noDok = 'RME-' + Date.now().toString().slice(-6);
    const isiDoc = JSON.stringify({
      keluhan: input.keluhan,
      pemeriksaan_fisik: input.pemeriksaan_fisik,
      diagnosa: input.diagnosa || input.asesmen,
      kode_icd10: input.kode_icd10,
      tindakan: input.tindakan_resep || input.rencana,
      protokol_tambahan: input.protokol_tambahan,
      sistolik: input.sistolik,
      diastolik: input.diastolik,
      djj: input.djj,
      tinggi_fundus: input.tinggi_fundus,
      catatan_edukasi: input.catatan_edukasi,
      tgl_kontrol_ulang: input.tgl_kontrol_ulang
    });

    await db.query(
      `INSERT INTO [Dokumen_Medis] (dokumen_id, kunjungan_id, staf_id, jenis, no_dokumen, isi, tgl_terbit)
       VALUES (NEWID(), @kid, @sid, 'RME', @noDok, @isi, CAST(SYSDATETIME() AS DATE))`,
      {
        kid: kunjunganId,
        sid: effectiveStafId,
        noDok,
        isi: isiDoc
      }
    );

    // Otomatis terbitkan / perbarui Tagihan (Layanan saat daftar + Obat dari RME Bidan) & tandai reservasi SELESAI
    let tagihanIdResult: string | null = null;
    try {
      await db.query(
        `UPDATE [Reservasi]
            SET status = 'SELESAI'
          WHERE pasien_id = @pid
            AND status IN ('MENUNGGU', 'DIPANGGIL')`,
        { pid: input.pasien_id }
      );

      if (kunjunganId) {
        let resolvedLayananId = input.layanan_id ?? null;
        if (!resolvedLayananId) {
          const rsvLay = await db.query<{ layanan_id: string }>(
            `SELECT TOP 1 layanan_id FROM [Reservasi]
              WHERE pasien_id = @pid AND layanan_id IS NOT NULL
              ORDER BY reservasi_id DESC`,
            { pid: input.pasien_id }
          );
          resolvedLayananId = rsvLay.recordset[0]?.layanan_id ?? null;
        }
        if (!resolvedLayananId) {
          const defaultLay = await db.query<{ layanan_id: string }>(
            `SELECT TOP 1 layanan_id FROM [Layanan_Medis] WHERE aktif = 1 ORDER BY nama ASC`
          );
          resolvedLayananId = defaultLay.recordset[0]?.layanan_id ?? null;
        }

        const tagRes = await db.query<{ tagihan_id: string; status: string }>(
          `SELECT TOP 1 tagihan_id, status FROM [Tagihan] WHERE kunjungan_id = @kid`,
          { kid: kunjunganId }
        );
        let tagihanId = tagRes.recordset[0]?.tagihan_id ?? null;
        const tagihanStatus = tagRes.recordset[0]?.status ?? 'BELUM_LUNAS';

        if (!tagihanId) {
          const createdT = await db.query<{ tagihan_id: string }>(
            `INSERT INTO [Tagihan] (kunjungan_id, total_tagihan, total_dibayar, status, tgl_terbit)
             OUTPUT INSERTED.tagihan_id
             VALUES (@kid, 0, 0, 'BELUM_LUNAS', SYSDATETIME())`,
            { kid: kunjunganId }
          );
          tagihanId = createdT.recordset[0]?.tagihan_id ?? null;
        }
        tagihanIdResult = tagihanId;

        if (tagihanId && tagihanStatus !== 'LUNAS') {
          if (resolvedLayananId) {
            await db.query(
              `IF NOT EXISTS (SELECT 1 FROM [Tagihan_Rincian] WHERE tagihan_id = @tid AND layanan_id = @lid)
               BEGIN
                 DECLARE @hrgLay DECIMAL(18,2) = ISNULL((
                   SELECT TOP 1 harga FROM [Harga_Layanan]
                    WHERE layanan_id = @lid
                      AND (berlaku_sampai IS NULL OR berlaku_sampai >= CAST(SYSDATETIME() AS DATE))
                    ORDER BY berlaku_dari DESC
                 ), 0);
                 INSERT INTO [Tagihan_Rincian] (tagihan_id, layanan_id, obat_id, paket_id, qty, harga_satuan, subtotal)
                 VALUES (@tid, @lid, NULL, NULL, 1, @hrgLay, @hrgLay);
               END`,
              { tid: tagihanId, lid: resolvedLayananId }
            );
          }

          if (Array.isArray(input.resep_obat) && input.resep_obat.length > 0) {
            await db.query(
              `DELETE FROM [Tagihan_Rincian] WHERE tagihan_id = @tid AND obat_id IS NOT NULL`,
              { tid: tagihanId }
            );
            for (const item of input.resep_obat) {
              const qty = Math.max(1, Number(item.qty) || 1);
              await db.query(
                `DECLARE @hrgObt DECIMAL(18,2) = ISNULL(@overrideHarga, ISNULL((
                   SELECT TOP 1 harga_jual FROM [Harga_Obat]
                    WHERE obat_id = @oid
                      AND (berlaku_sampai IS NULL OR berlaku_sampai >= CAST(SYSDATETIME() AS DATE))
                    ORDER BY berlaku_dari DESC
                 ), 0));
                 INSERT INTO [Tagihan_Rincian] (tagihan_id, layanan_id, obat_id, paket_id, qty, harga_satuan, subtotal)
                 VALUES (@tid, NULL, @oid, NULL, @qty, @hrgObt, @hrgObt * @qty);`,
                {
                  tid: tagihanId,
                  oid: item.obat_id,
                  qty,
                  overrideHarga: item.harga_satuan && item.harga_satuan > 0 ? item.harga_satuan : null
                }
              );
            }
          }

          await db.query(
            `DECLARE @sumTot DECIMAL(18,2) = ISNULL((SELECT SUM(subtotal) FROM [Tagihan_Rincian] WHERE tagihan_id = @tid), 0);
             UPDATE [Tagihan]
                SET total_tagihan = @sumTot,
                    status = CASE WHEN total_dibayar >= @sumTot AND @sumTot > 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END
              WHERE tagihan_id = @tid`,
            { tid: tagihanId }
          );
        }
      }
    } catch {
      // Lanjutkan respons simpan RME meskipun sinkronisasi billing gagal
    }

    return {
      pemeriksaan_id: pemeriksaanId,
      kunjungan_id: kunjunganId,
      tagihan_id: tagihanIdResult,
      no_dokumen: noDok,
      waktu: new Date().toISOString()
    };
  }

  async listRme(limit: number, pasienId?: string): Promise<Record<string, unknown>[]> {
    const result = await db.query<Record<string, unknown>>(
      `SELECT TOP (@limit)
              pem.pemeriksaan_id AS id,
              CONVERT(VARCHAR(16), pem.waktu, 120) AS waktu,
              p.nama AS pasien_nama,
              p.nik,
              p.no_rm,
              pem.asesmen AS diagnosa,
              pem.rencana AS tindakan,
              CONCAT(tv.sistolik, '/', tv.diastolik, ' mmHg') AS tekanan_darah,
              pem.keluhan,
              pem.pemeriksaan_fisik,
              COALESCE(dm.no_dokumen, 'RME-' + RIGHT(CAST(pem.pemeriksaan_id AS VARCHAR(36)), 6)) AS no_dokumen,
              dm.isi AS isi_dokumen
         FROM [Pemeriksaan] pem
         JOIN [Kunjungan] k ON k.kunjungan_id = pem.kunjungan_id
         JOIN [Pasien] p ON p.pasien_id = k.pasien_id
         LEFT JOIN [Tanda_Vital] tv ON tv.pemeriksaan_id = pem.pemeriksaan_id
         LEFT JOIN [Dokumen_Medis] dm ON dm.kunjungan_id = k.kunjungan_id AND dm.jenis = 'RME'
        WHERE (@pasien_id IS NULL OR p.pasien_id = @pasien_id)
        ORDER BY pem.waktu DESC`,
      { limit, pasien_id: pasienId ?? null }
    );
    return result.recordset;
  }
}

export default KlinisRepository;

-- =====================================================================
-- 07_audit_triggers.sql
-- 27 trigger audit per tabel + trg_audit_logs_immutable (lihat TSD 1.3).
-- Diturunkan otomatis oleh generate_ddl.py.
-- SESSION_CONTEXT('akun_id'), ('user_ref') & ('keterangan') di-set backend per request.
-- =====================================================================
USE MiniWorldRS;
GO

-- Trigger harus dibuat dengan SET option ini agar INSERT/UPDATE pada tabel
-- ber-filtered index tidak gagal saat trigger dieksekusi.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pasien] ON dbo.[Pasien]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pasien',
        CAST(COALESCE((SELECT TOP 1 [pasien_id] FROM deleted), (SELECT TOP 1 [pasien_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT pasien_id, no_rm, nik, nama, jenis_kelamin, tgl_lahir, tempat_lahir, alamat, no_telepon, gol_darah, status_pernikahan, pekerjaan, ibu_pasien_id, created_at, email FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT pasien_id, no_rm, nik, nama, jenis_kelamin, tgl_lahir, tempat_lahir, alamat, no_telepon, gol_darah, status_pernikahan, pekerjaan, ibu_pasien_id, created_at, email FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pasien' WHEN 'UPDATE' THEN N'Ubah Pasien' ELSE N'Hapus Pasien' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_staf] ON dbo.[Staf]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Staf',
        CAST(COALESCE((SELECT TOP 1 [staf_id] FROM deleted), (SELECT TOP 1 [staf_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT staf_id, nip, nama, jenis_kelamin, tgl_lahir, no_telepon, alamat, profesi_id, unit_id, jabatan, status_kepegawaian, tgl_masuk, aktif, email FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT staf_id, nip, nama, jenis_kelamin, tgl_lahir, no_telepon, alamat, profesi_id, unit_id, jabatan, status_kepegawaian, tgl_masuk, aktif, email FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Staf' WHEN 'UPDATE' THEN N'Ubah Staf' ELSE N'Hapus Staf' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_akun_pengguna] ON dbo.[Akun_Pengguna]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Akun_Pengguna',
        CAST(COALESCE((SELECT TOP 1 [akun_id] FROM deleted), (SELECT TOP 1 [akun_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT akun_id, staf_id, peran_id, username, aktif, percobaan_gagal, terkunci_sampai, last_login_at, pasien_id, sub_peran FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT akun_id, staf_id, peran_id, username, aktif, percobaan_gagal, terkunci_sampai, last_login_at, pasien_id, sub_peran FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Akun_Pengguna' WHEN 'UPDATE' THEN N'Ubah Akun_Pengguna' ELSE N'Hapus Akun_Pengguna' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_jadwal_praktik] ON dbo.[Jadwal_Praktik]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Jadwal_Praktik',
        CAST(COALESCE((SELECT TOP 1 [jadwal_id] FROM deleted), (SELECT TOP 1 [jadwal_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT jadwal_id, staf_id, unit_id, ruangan_id, tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien, aktif FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT jadwal_id, staf_id, unit_id, ruangan_id, tanggal, jam_mulai, jam_selesai, kuota_maks, durasi_per_pasien, aktif FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Jadwal_Praktik' WHEN 'UPDATE' THEN N'Ubah Jadwal_Praktik' ELSE N'Hapus Jadwal_Praktik' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_reservasi] ON dbo.[Reservasi]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Reservasi',
        CAST(COALESCE((SELECT TOP 1 [reservasi_id] FROM deleted), (SELECT TOP 1 [reservasi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT reservasi_id, pasien_id, jadwal_id, layanan_id, dibuat_oleh, nomor_antrean, estimasi_jam, status, metode_daftar, created_at FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT reservasi_id, pasien_id, jadwal_id, layanan_id, dibuat_oleh, nomor_antrean, estimasi_jam, status, metode_daftar, created_at FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Mendaftar Antrian' WHEN 'UPDATE' THEN N'Ubah Reservasi' ELSE N'Batal Antrian' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_kunjungan] ON dbo.[Kunjungan]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Kunjungan',
        CAST(COALESCE((SELECT TOP 1 [kunjungan_id] FROM deleted), (SELECT TOP 1 [kunjungan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT kunjungan_id, pasien_id, reservasi_id, unit_id, dpjp_staf_id, penjamin_id, koreksi_dari_id, jenis_kunjungan, tgl_masuk, tgl_keluar, cara_keluar, status, created_at FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT kunjungan_id, pasien_id, reservasi_id, unit_id, dpjp_staf_id, penjamin_id, koreksi_dari_id, jenis_kunjungan, tgl_masuk, tgl_keluar, cara_keluar, status, created_at FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Kunjungan' WHEN 'UPDATE' THEN N'Ubah Kunjungan' ELSE N'Hapus Kunjungan' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pemeriksaan] ON dbo.[Pemeriksaan]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pemeriksaan',
        CAST(COALESCE((SELECT TOP 1 [pemeriksaan_id] FROM deleted), (SELECT TOP 1 [pemeriksaan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT pemeriksaan_id, kunjungan_id, staf_id, keluhan, pemeriksaan_fisik, asesmen, rencana, catatan_bebas, waktu FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT pemeriksaan_id, kunjungan_id, staf_id, keluhan, pemeriksaan_fisik, asesmen, rencana, catatan_bebas, waktu FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pemeriksaan' WHEN 'UPDATE' THEN N'Ubah Pemeriksaan' ELSE N'Hapus Pemeriksaan' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_alergi_kondisi] ON dbo.[Alergi_Kondisi]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Alergi_Kondisi',
        CAST(COALESCE((SELECT TOP 1 [alergi_id] FROM deleted), (SELECT TOP 1 [alergi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT alergi_id, pasien_id, obat_id, dicatat_oleh, kategori, nama, keterangan, aktif, created_at FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT alergi_id, pasien_id, obat_id, dicatat_oleh, kategori, nama, keterangan, aktif, created_at FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Alergi_Kondisi' WHEN 'UPDATE' THEN N'Ubah Alergi_Kondisi' ELSE N'Hapus Alergi_Kondisi' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_kunjungan_diagnosa] ON dbo.[Kunjungan_Diagnosa]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Kunjungan_Diagnosa',
        CAST(COALESCE((SELECT TOP 1 [kunjungan_id] FROM deleted), (SELECT TOP 1 [kunjungan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT kunjungan_id, diagnosa_id, jenis, keterangan FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT kunjungan_id, diagnosa_id, jenis, keterangan FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Kunjungan_Diagnosa' WHEN 'UPDATE' THEN N'Ubah Kunjungan_Diagnosa' ELSE N'Hapus Kunjungan_Diagnosa' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_kehamilan] ON dbo.[Kehamilan]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Kehamilan',
        CAST(COALESCE((SELECT TOP 1 [kehamilan_id] FROM deleted), (SELECT TOP 1 [kehamilan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT kehamilan_id, pasien_id, hpht, hpl, gravida, paritas, abortus, status_risiko, status FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT kehamilan_id, pasien_id, hpht, hpl, gravida, paritas, abortus, status_risiko, status FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Kehamilan' WHEN 'UPDATE' THEN N'Ubah Kehamilan' ELSE N'Hapus Kehamilan' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_persalinan] ON dbo.[Persalinan]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Persalinan',
        CAST(COALESCE((SELECT TOP 1 [persalinan_id] FROM deleted), (SELECT TOP 1 [persalinan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT persalinan_id, kehamilan_id, kunjungan_id, penolong_staf_id, waktu_persalinan, jenis_persalinan, komplikasi, kondisi_ibu FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT persalinan_id, kehamilan_id, kunjungan_id, penolong_staf_id, waktu_persalinan, jenis_persalinan, komplikasi, kondisi_ibu FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Persalinan' WHEN 'UPDATE' THEN N'Ubah Persalinan' ELSE N'Hapus Persalinan' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_bayi_lahir] ON dbo.[Bayi_Lahir]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Bayi_Lahir',
        CAST(COALESCE((SELECT TOP 1 [bayi_id] FROM deleted), (SELECT TOP 1 [bayi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT bayi_id, persalinan_id, pasien_id, berat_lahir_gram, panjang_lahir_cm, apgar_1, apgar_5, kondisi FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT bayi_id, persalinan_id, pasien_id, berat_lahir_gram, panjang_lahir_cm, apgar_1, apgar_5, kondisi FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Bayi_Lahir' WHEN 'UPDATE' THEN N'Ubah Bayi_Lahir' ELSE N'Hapus Bayi_Lahir' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_asuhan_bbl] ON dbo.[Asuhan_BBL]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Asuhan_BBL',
        CAST(COALESCE((SELECT TOP 1 [asuhan_bbl_id] FROM deleted), (SELECT TOP 1 [asuhan_bbl_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT asuhan_bbl_id, bayi_id, staf_id, imd, vit_k1, salep_mata, hb0, keadaan_umum, catatan, dicatat_pada FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT asuhan_bbl_id, bayi_id, staf_id, imd, vit_k1, salep_mata, hb0, keadaan_umum, catatan, dicatat_pada FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Asuhan_BBL' WHEN 'UPDATE' THEN N'Ubah Asuhan_BBL' ELSE N'Hapus Asuhan_BBL' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pemeriksaan_bayi] ON dbo.[Pemeriksaan_Bayi]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pemeriksaan_Bayi',
        CAST(COALESCE((SELECT TOP 1 [pemeriksaan_bayi_id] FROM deleted), (SELECT TOP 1 [pemeriksaan_bayi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT pemeriksaan_bayi_id, bayi_id, kunjungan_id, staf_id, jenis, tgl_pemeriksaan, berat_gram, panjang_cm, lingkar_kepala_cm, suhu_c, kondisi_tali_pusat, menyusu, ikterus, tanda_bahaya, tgl_kontrol_berikutnya, catatan, created_at FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT pemeriksaan_bayi_id, bayi_id, kunjungan_id, staf_id, jenis, tgl_pemeriksaan, berat_gram, panjang_cm, lingkar_kepala_cm, suhu_c, kondisi_tali_pusat, menyusu, ikterus, tanda_bahaya, tgl_kontrol_berikutnya, catatan, created_at FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pemeriksaan_Bayi' WHEN 'UPDATE' THEN N'Ubah Pemeriksaan_Bayi' ELSE N'Hapus Pemeriksaan_Bayi' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_imunisasi_pasien] ON dbo.[Imunisasi_Pasien]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Imunisasi_Pasien',
        CAST(COALESCE((SELECT TOP 1 [imunisasi_id] FROM deleted), (SELECT TOP 1 [imunisasi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT imunisasi_id, pasien_id, vaksin_id, kunjungan_id, batch_id, staf_id, dosis_ke, tanggal FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT imunisasi_id, pasien_id, vaksin_id, kunjungan_id, batch_id, staf_id, dosis_ke, tanggal FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Imunisasi_Pasien' WHEN 'UPDATE' THEN N'Ubah Imunisasi_Pasien' ELSE N'Hapus Imunisasi_Pasien' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pelayanan_kb] ON dbo.[Pelayanan_KB]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pelayanan_KB',
        CAST(COALESCE((SELECT TOP 1 [kb_id] FROM deleted), (SELECT TOP 1 [kb_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT kb_id, pasien_id, metode_id, kunjungan_id, tanggal, kontrol_berikutnya, efek_samping FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT kb_id, pasien_id, metode_id, kunjungan_id, tanggal, kontrol_berikutnya, efek_samping FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pelayanan_KB' WHEN 'UPDATE' THEN N'Ubah Pelayanan_KB' ELSE N'Hapus Pelayanan_KB' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_rawat_inap] ON dbo.[Rawat_Inap]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Rawat_Inap',
        CAST(COALESCE((SELECT TOP 1 [rawat_inap_id] FROM deleted), (SELECT TOP 1 [rawat_inap_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT rawat_inap_id, kunjungan_id, bed_id, tgl_masuk, tgl_keluar, alasan_pindah, catatan_pulang FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT rawat_inap_id, kunjungan_id, bed_id, tgl_masuk, tgl_keluar, alasan_pindah, catatan_pulang FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Rawat_Inap' WHEN 'UPDATE' THEN N'Ubah Rawat_Inap' ELSE N'Hapus Rawat_Inap' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_tempat_tidur] ON dbo.[Tempat_Tidur]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Tempat_Tidur',
        CAST(COALESCE((SELECT TOP 1 [bed_id] FROM deleted), (SELECT TOP 1 [bed_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT bed_id, ruangan_id, kelas_id, no_bed, status FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT bed_id, ruangan_id, kelas_id, no_bed, status FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Tempat_Tidur' WHEN 'UPDATE' THEN N'Ubah Tempat_Tidur' ELSE N'Hapus Tempat_Tidur' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_operasi] ON dbo.[Operasi]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Operasi',
        CAST(COALESCE((SELECT TOP 1 [operasi_id] FROM deleted), (SELECT TOP 1 [operasi_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT operasi_id, kunjungan_id, layanan_id, ruangan_id, jenis_anestesi, jadwal_mulai, waktu_mulai, waktu_selesai, status, laporan FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT operasi_id, kunjungan_id, layanan_id, ruangan_id, jenis_anestesi, jadwal_mulai, waktu_mulai, waktu_selesai, status, laporan FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Operasi' WHEN 'UPDATE' THEN N'Ubah Operasi' ELSE N'Hapus Operasi' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_order_penunjang] ON dbo.[Order_Penunjang]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Order_Penunjang',
        CAST(COALESCE((SELECT TOP 1 [order_id] FROM deleted), (SELECT TOP 1 [order_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT order_id, kunjungan_id, staf_pemesan_id, jenis, waktu_order, status FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT order_id, kunjungan_id, staf_pemesan_id, jenis, waktu_order, status FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Order_Penunjang' WHEN 'UPDATE' THEN N'Ubah Order_Penunjang' ELSE N'Hapus Order_Penunjang' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_obat] ON dbo.[Obat]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Obat',
        CAST(COALESCE((SELECT TOP 1 [obat_id] FROM deleted), (SELECT TOP 1 [obat_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT obat_id, kode, nama_generik, nama_dagang, kategori, bentuk, satuan, kekuatan, golongan, stok_minimum, aktif FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT obat_id, kode, nama_generik, nama_dagang, kategori, bentuk, satuan, kekuatan, golongan, stok_minimum, aktif FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Obat' WHEN 'UPDATE' THEN N'Ubah Obat' ELSE N'Hapus Obat' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_batch_obat] ON dbo.[Batch_Obat]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Batch_Obat',
        CAST(COALESCE((SELECT TOP 1 [batch_id] FROM deleted), (SELECT TOP 1 [batch_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT batch_id, obat_id, penerimaan_id, no_batch, tgl_kedaluwarsa, harga_beli, tgl_masuk FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT batch_id, obat_id, penerimaan_id, no_batch, tgl_kedaluwarsa, harga_beli, tgl_masuk FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Batch_Obat' WHEN 'UPDATE' THEN N'Ubah Batch_Obat' ELSE N'Hapus Batch_Obat' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_stok_batch] ON dbo.[Stok_Batch]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Stok_Batch',
        CAST(COALESCE((SELECT TOP 1 [batch_id] FROM deleted), (SELECT TOP 1 [batch_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT batch_id, gudang_id, jumlah FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT batch_id, gudang_id, jumlah FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Stok_Batch' WHEN 'UPDATE' THEN N'Ubah Stok_Batch' ELSE N'Hapus Stok_Batch' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_resep] ON dbo.[Resep]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Resep',
        CAST(COALESCE((SELECT TOP 1 [resep_id] FROM deleted), (SELECT TOP 1 [resep_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT resep_id, kunjungan_id, staf_id, tanggal, status, override_alergi, alasan_override FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT resep_id, kunjungan_id, staf_id, tanggal, status, override_alergi, alasan_override FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Resep' WHEN 'UPDATE' THEN N'Ubah Resep' ELSE N'Hapus Resep' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pengeluaran_obat] ON dbo.[Pengeluaran_Obat]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pengeluaran_Obat',
        CAST(COALESCE((SELECT TOP 1 [pengeluaran_id] FROM deleted), (SELECT TOP 1 [pengeluaran_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT pengeluaran_id, resep_id, obat_id, batch_id, gudang_id, apoteker_staf_id, jumlah, waktu FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT pengeluaran_id, resep_id, obat_id, batch_id, gudang_id, apoteker_staf_id, jumlah, waktu FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pengeluaran_Obat' WHEN 'UPDATE' THEN N'Ubah Pengeluaran_Obat' ELSE N'Hapus Pengeluaran_Obat' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_tagihan] ON dbo.[Tagihan]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Tagihan',
        CAST(COALESCE((SELECT TOP 1 [tagihan_id] FROM deleted), (SELECT TOP 1 [tagihan_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT tagihan_id, kunjungan_id, total_tagihan, total_dibayar, status, tgl_terbit FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT tagihan_id, kunjungan_id, total_tagihan, total_dibayar, status, tgl_terbit FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Tagihan' WHEN 'UPDATE' THEN N'Ubah Tagihan' ELSE N'Hapus Tagihan' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_pembayaran] ON dbo.[Pembayaran]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @aksi VARCHAR(40) =
        CASE WHEN EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE'
             WHEN EXISTS (SELECT 1 FROM inserted) THEN 'INSERT'
             ELSE 'DELETE' END;
    INSERT INTO dbo.[Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
    SELECT
        TRY_CAST(SESSION_CONTEXT(N'akun_id') AS UNIQUEIDENTIFIER),
        @aksi,
        N'Pembayaran',
        CAST(COALESCE((SELECT TOP 1 [pembayaran_id] FROM deleted), (SELECT TOP 1 [pembayaran_id] FROM inserted)) AS VARCHAR(40)),
        COALESCE((SELECT pembayaran_id, tagihan_id, penjamin_id, kasir_staf_id, jumlah, metode, jenis, waktu_bayar FROM deleted FOR JSON PATH), N'[]'),
        COALESCE((SELECT pembayaran_id, tagihan_id, penjamin_id, kasir_staf_id, jumlah, metode, jenis, waktu_bayar FROM inserted FOR JSON PATH), N'[]'),
        COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''),
        SYSDATETIME(),
        CONVERT(NVARCHAR(50), SESSION_CONTEXT(N'user_ref')),
        COALESCE(
            CONVERT(NVARCHAR(200), SESSION_CONTEXT(N'keterangan')),
            CASE @aksi WHEN 'INSERT' THEN N'Tambah Pembayaran' WHEN 'UPDATE' THEN N'Ubah Pembayaran' ELSE N'Hapus Pembayaran' END);
END
GO

CREATE OR ALTER TRIGGER dbo.[trg_audit_logs_immutable] ON dbo.[Audit_Log]
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50001, 'Audit_Log bersifat append-only: UPDATE/DELETE ditolak.', 1;
END
GO

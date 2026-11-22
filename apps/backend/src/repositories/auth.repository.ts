import db from '../db/pool';
import type { Peran, SubPeran } from '../types';

export interface AkunRow {
  akun_id: string;
  password_hash: string;
  aktif: boolean;
  pasien_id: string | null;
  staf_id: string | null;
  sub_peran: SubPeran | null;
  peran: Peran;
  terkunci_sampai: Date | null;
  unit_id: string | null;
}

export interface OtpRow {
  otp_id: string;
  kode_hash: string;
}

export class AuthRepository {
  async findAkunByUsername(username: string): Promise<AkunRow | undefined> {
    const result = await db.query<AkunRow>(
      `SELECT a.akun_id, a.password_hash, a.aktif, a.pasien_id, a.staf_id, a.sub_peran,
              a.terkunci_sampai, p.kode AS peran, s.unit_id
         FROM [Akun_Pengguna] a
         JOIN [Peran] p ON p.peran_id = a.peran_id
         LEFT JOIN [Staf] s ON s.staf_id = a.staf_id
        WHERE a.username = @username`,
      { username }
    );
    return result.recordset[0];
  }

  async findAkunIdByEmail(email: string): Promise<string | null> {
    const result = await db.query<{ akun_id: string }>(
      `SELECT a.akun_id FROM [Akun_Pengguna] a
         LEFT JOIN [Pasien] p ON p.pasien_id = a.pasien_id
         LEFT JOIN [Staf] s ON s.staf_id = a.staf_id
        WHERE p.email = @email OR s.email = @email`,
      { email }
    );
    return result.recordset[0]?.akun_id ?? null;
  }

  async recordFailedAttempt(akunId: string, username: string): Promise<void> {
    await db.query(
      `UPDATE [Akun_Pengguna]
          SET percobaan_gagal = percobaan_gagal + 1,
              terkunci_sampai = CASE WHEN percobaan_gagal + 1 >= 5
                                     THEN DATEADD(MINUTE, 15, SYSDATETIME()) ELSE terkunci_sampai END
        WHERE akun_id = @id`,
      { id: akunId },
      { akunId, userRef: username, keterangan: 'Login Gagal' }
    );
  }

  async recordLoginSuccess(akunId: string, username: string): Promise<void> {
    await db.query(
      `UPDATE [Akun_Pengguna] SET last_login_at = SYSDATETIME(), percobaan_gagal = 0 WHERE akun_id = @id`,
      { id: akunId },
      { akunId, userRef: username, keterangan: 'Login' }
    );
  }

  async recordAudit(akunId: string, userRef: string, aksi: string, keterangan: string): Promise<void> {
    await db.query(
      `INSERT INTO [Audit_Log] ([akun_id], [aksi], [tabel], [id_baris], [nilai_lama], [nilai_baru], [ip_address], [waktu], [user_ref], [keterangan])
       VALUES (@akunId, @aksi, N'Akun_Pengguna', @akunId, N'[]', N'[]',
               COALESCE(CONVERT(VARCHAR(45), CONNECTIONPROPERTY('client_net_address')), ''), SYSDATETIME(), @userRef, @ket)`,
      { akunId, aksi, userRef, ket: keterangan }
    );
  }

  async createOtp(akunId: string, kodeHash: string): Promise<void> {
    await db.query(
      `INSERT INTO [Otp_Reset] (akun_id, kode_hash, expired_at, dipakai)
       VALUES (@id, @hash, DATEADD(MINUTE, 15, SYSDATETIME()), 0)`,
      { id: akunId, hash: kodeHash }
    );
  }

  async recordNotification(
    email: string,
    pesan: string,
    status: 'TERKIRIM' | 'ANTRE' = 'ANTRE'
  ): Promise<void> {
    await db.query(
      `INSERT INTO [Notifikasi_Log] (jenis, tujuan, pesan, status, retry_count, waktu_kirim)
       VALUES ('OTP_RESET', @email, @pesan, @status, 0, SYSDATETIME())`,
      { email, pesan, status }
    );
  }

  async enqueueNotification(email: string, pesan: string): Promise<void> {
    await this.recordNotification(email, pesan, 'ANTRE');
  }

  async findActiveOtp(akunId: string): Promise<OtpRow | undefined> {
    const result = await db.query<OtpRow>(
      `SELECT TOP 1 otp_id, kode_hash FROM [Otp_Reset]
        WHERE akun_id = @id AND dipakai = 0 AND expired_at > SYSDATETIME()
        ORDER BY created_at DESC`,
      { id: akunId }
    );
    return result.recordset[0];
  }

  async updatePassword(akunId: string, hash: string): Promise<void> {
    await db.query(`UPDATE [Akun_Pengguna] SET password_hash = @hash WHERE akun_id = @id`, {
      id: akunId,
      hash
    });
  }

  async markOtpUsed(akunId: string): Promise<void> {
    await db.query(`UPDATE [Otp_Reset] SET dipakai = 1 WHERE akun_id = @id AND dipakai = 0`, {
      id: akunId
    });
  }
}

export default AuthRepository;

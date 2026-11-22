import bcrypt from 'bcryptjs';
import ApiError from '../errors/ApiError';
import AdminRepository from '../repositories/admin.repository';
import type { AkunBody, PemeliharaanBody } from '../validation/admin';

export class AdminService {
  constructor(private readonly repository: AdminRepository = new AdminRepository()) {}

  async createAkun(stafId: string, body: AkunBody): Promise<Record<string, unknown>> {
    if (body.peran === 'STAFF' && !body.sub_peran) {
      throw ApiError.validation('sub_peran wajib diisi untuk peran STAFF');
    }
    if (body.peran !== 'STAFF' && body.sub_peran) {
      throw ApiError.validation('sub_peran hanya berlaku untuk peran STAFF');
    }

    if (!(await this.repository.findStaf(stafId))) {
      throw ApiError.notFound('Staf tidak ditemukan');
    }

    const peranId = await this.repository.findPeranId(body.peran);
    if (!peranId) {
      throw ApiError.badRequest(`Peran ${body.peran} tidak ditemukan pada master Peran`);
    }

    if ((await this.repository.countUsername(body.username)) > 0) {
      throw ApiError.conflict('Username sudah digunakan');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const row = await this.repository.createAkun({
      stafId,
      peranId,
      username: body.username,
      passwordHash,
      subPeran: body.sub_peran
    });
    if (!row) {
      throw ApiError.internal('Gagal membuat akun');
    }
    return row;
  }

  async createPemeliharaan(asetId: string, body: PemeliharaanBody): Promise<Record<string, unknown>> {
    if (!body.teknisi_staf_id) {
      throw ApiError.validation('Validasi gagal', [
        { path: ['teknisi_staf_id'], message: 'teknisi_staf_id wajib diisi' }
      ]);
    }
    const row = await this.repository.createPemeliharaan({
      asetId,
      teknisiStafId: body.teknisi_staf_id,
      jenis: body.jenis,
      tanggal: body.tanggal,
      biaya: body.biaya,
      hasil: body.hasil,
      jadwalBerikutnya: body.jadwal_berikutnya
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan pemeliharaan aset');
    }

    if (body.jadwal_berikutnya) {
      await this.repository.enqueueKalibrasi(asetId, body.jadwal_berikutnya);
    }
    return row;
  }
}

export default AdminService;

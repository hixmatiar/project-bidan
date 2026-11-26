import ApiError from '../errors/ApiError';
import { paginate } from '../validation/common';
import PasienRepository from '../repositories/pasien.repository';
import type {
  AlergiBody,
  AlergiUpdateBody,
  KonfirmasiRedFlagBody,
  WalkInBody
} from '../validation/pasien';

export class PasienService {
  constructor(private readonly repository: PasienRepository = new PasienRepository()) {}

  listIdentitas(limit?: number, q?: string): Promise<Record<string, unknown>[]> {
    const term = q ? `%${q}%` : null;
    return this.repository.searchIdentitas(paginate(limit, 50, 200), term);
  }

  async walkIn(body: WalkInBody): Promise<{ pasien_id: string; kunjungan_id: string | null }> {
    let pasienId = await this.repository.findByNik(body.nik);
    if (!pasienId) {
      pasienId = await this.repository.createPasien(body);
    }
    if (!pasienId) {
      throw ApiError.internal('Gagal membuat data pasien');
    }

    const dpjp = body.dpjp_staf_id ?? (await this.repository.findDokterAktif());
    if (!dpjp) {
      throw ApiError.badRequest('Tidak ada dokter aktif untuk dijadikan DPJP');
    }

    const penjamin = body.penjamin_id ?? (await this.repository.findPenjaminPertama());
    if (!penjamin) {
      throw ApiError.badRequest('Tidak ada penjamin terdaftar');
    }

    const kunjunganId = await this.repository.createKunjungan({
      pasienId,
      unitId: body.unit_id,
      dpjpId: dpjp,
      penjaminId: penjamin,
      jenis: body.jenis_kunjungan
    });

    if (
      kunjunganId &&
      (body.layanan_id || body.jadwal_id) &&
      typeof this.repository.syncWalkInReservasiDanTagihan === 'function'
    ) {
      const extra = await this.repository.syncWalkInReservasiDanTagihan({
        pasienId,
        kunjunganId,
        layananId: body.layanan_id,
        jadwalId: body.jadwal_id
      });
      if (extra.nomor_antrean !== undefined) {
        return {
          pasien_id: pasienId,
          kunjungan_id: kunjunganId,
          nomor_antrean: extra.nomor_antrean
        } as { pasien_id: string; kunjungan_id: string | null };
      }
    }

    return { pasien_id: pasienId, kunjungan_id: kunjunganId };
  }

  list(limit?: number, q?: string): Promise<Record<string, unknown>[]> {
    const term = q ? `%${q}%` : null;
    return this.repository.listPasien(paginate(limit, 50, 200), term);
  }

  async rmeDetail(id: string): Promise<Record<string, unknown>> {
    const pasien = await this.repository.findById(id);
    if (!pasien) {
      throw ApiError.fromCode('ERR-RME-04');
    }
    const [alergi, kunjungan, kehamilan] = await Promise.all([
      this.repository.listAlergi(id),
      this.repository.listKunjungan(id),
      this.repository.listKehamilan(id)
    ]);
    return { pasien, alergi, kunjungan, kehamilan };
  }

  async addAlergi(
    id: string,
    body: AlergiBody,
    dicatatOleh: string | null
  ): Promise<Record<string, unknown>> {
    if (!dicatatOleh) {
      throw ApiError.validation('Validasi gagal', [
        { path: ['dicatat_oleh'], message: 'Akun ini tidak terhubung ke data staf' }
      ]);
    }
    const row = await this.repository.createAlergi(id, body, dicatatOleh);
    if (!row) {
      throw ApiError.internal('Gagal menyimpan alergi');
    }
    return row;
  }

  async updateAlergi(id: string, body: AlergiUpdateBody): Promise<Record<string, unknown>> {
    if (Object.keys(body).length === 0) {
      throw ApiError.validation('Tidak ada perubahan');
    }
    const row = await this.repository.updateAlergi(id, body as Record<string, unknown>);
    if (!row) {
      throw ApiError.notFound('Data alergi tidak ditemukan');
    }
    return row;
  }

  async konfirmasiRedFlag(
    id: string,
    body: KonfirmasiRedFlagBody,
    auth: { stafId: string | null; akunId: string } | undefined
  ): Promise<Record<string, unknown>> {
    if (body.kunjungan_id) {
      await this.repository.createCatatanKeperawatan({
        kunjunganId: body.kunjungan_id,
        stafId: auth?.stafId ?? null,
        isi: body.catatan ?? 'Tenaga klinis mengonfirmasi pembacaan red-flag pasien'
      });
    }
    return { pasien_id: id, dikonfirmasi: true, oleh: auth?.akunId ?? null };
  }

  async exportRme(id: string): Promise<Record<string, unknown>> {
    const pasien = await this.repository.findById(id);
    if (!pasien) {
      throw ApiError.fromCode('ERR-RME-04');
    }
    const kunjungan = await this.repository.listKunjunganExport(id);
    return { pasien, kunjungan, format: 'JSON' };
  }
}

export default PasienService;

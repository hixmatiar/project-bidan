import ApiError from '../errors/ApiError';
import { paginate, periodRange } from '../validation/common';
import KeuanganRepository from '../repositories/keuangan.repository';
import type {
  BayarBody,
  HargaBody,
  RefParams,
  TagihanListInput
} from '../validation/keuangan';

export class KeuanganService {
  constructor(private readonly repository: KeuanganRepository = new KeuanganRepository()) {}

  private pastikanStaf(stafId: string | null): string {
    if (!stafId) {
      throw ApiError.validation('Validasi gagal', [
        { path: ['staf_id'], message: 'Akun ini tidak terhubung ke data staf' }
      ]);
    }
    return stafId;
  }

  async detailTagihan(kunjunganId: string): Promise<Record<string, unknown>> {
    if (!(await this.repository.kunjunganExists(kunjunganId))) {
      throw ApiError.notFound('Kunjungan tidak ditemukan');
    }
    let tagihanId = await this.repository.findTagihanIdByKunjungan(kunjunganId);
    if (!tagihanId) {
      tagihanId = await this.repository.createTagihan(kunjunganId);
    }
    if (!tagihanId) {
      throw ApiError.internal('Gagal membuat tagihan');
    }

    const [rincian, header] = await Promise.all([
      this.repository.listRincian(tagihanId),
      this.repository.findTagihan(tagihanId)
    ]);
    return { ...header, rincian };
  }

  async bayar(id: string, body: BayarBody, stafId: string | null): Promise<Record<string, unknown>> {
    const kasir = this.pastikanStaf(stafId);
    const tagihan = await this.repository.findTagihan(id);
    if (!tagihan) {
      throw ApiError.fromCode('ERR-FIN-02');
    }

    const totalTagihan = Number(tagihan['total_tagihan'] ?? 0);
    const totalDibayar = Number(tagihan['total_dibayar'] ?? 0);
    const sisa = totalTagihan - totalDibayar;
    if (body.jumlah > sisa) {
      throw ApiError.fromCode('ERR-FIN-01', { sisa_tagihan: sisa });
    }

    const penjaminId = body.penjamin_id ?? (await this.repository.findPenjaminMandiri());
    if (!penjaminId) {
      throw ApiError.validation('Validasi gagal', [
        { path: ['penjamin_id'], message: 'penjamin_id wajib diisi karena penjamin default tidak tersedia' }
      ]);
    }

    await this.repository.createPembayaran({
      tagihanId: id,
      penjaminId,
      kasirStafId: kasir,
      jumlah: body.jumlah,
      metode: body.metode,
      jenis: body.jenis
    });

    const dibayarBaru = totalDibayar + body.jumlah;
    const status = dibayarBaru >= totalTagihan ? 'LUNAS' : 'BAYAR_SEBAGIAN';
    const row = await this.repository.updatePembayaranTagihan(id, dibayarBaru, status);
    if (!row) {
      throw ApiError.fromCode('ERR-FIN-02');
    }
    return row;
  }

  list(body: TagihanListInput): Promise<Record<string, unknown>[]> {
    periodRange(body);
    return this.repository.listTagihan(
      paginate(body.limit, 100, 500),
      body.status ?? null,
      body.dari ?? null,
      body.sampai ?? null
    );
  }

  rekap(body: TagihanListInput): Promise<Record<string, unknown>[]> {
    periodRange(body);
    return this.repository.rekap(body.dari ?? null, body.sampai ?? null);
  }

  async listHarga(): Promise<{ layanan: Record<string, unknown>[]; obat: Record<string, unknown>[] }> {
    const [layanan, obat] = await Promise.all([
      this.repository.listHargaLayanan(),
      this.repository.listHargaObat()
    ]);
    return { layanan, obat };
  }

  async setHarga(
    params: RefParams,
    body: HargaBody,
    stafId: string | null
  ): Promise<Record<string, unknown>> {
    const staf = this.pastikanStaf(stafId);
    if (body.harga <= 0) {
      throw ApiError.fromCode('ERR-PRC-01');
    }
    if (body.berlaku_dari) {
      const hariIni = new Date().toISOString().slice(0, 10);
      if (body.berlaku_dari < hariIni) {
        throw ApiError.fromCode('ERR-PRC-01', null, 'Tanggal berlaku tidak boleh mundur');
      }
    }

    const alasan = body.alasan.trim();
    if (alasan.length < 3) {
      throw ApiError.validation('Validasi gagal', [
        { path: ['alasan'], message: 'Alasan minimal 3 karakter' }
      ]);
    }

    if (params.ref_tipe === 'LAYANAN') {
      await this.repository.closeHargaLayanan(params.ref_id);
      const created = await this.repository.insertHargaLayanan({
        layananId: params.ref_id,
        kelasId: body.kelas_id,
        penjaminId: body.penjamin_id,
        stafId: staf,
        harga: body.harga,
        berlakuDari: body.berlaku_dari,
        alasan
      });
      if (!created) {
        throw ApiError.internal('Gagal menyimpan harga layanan');
      }
      return created;
    }

    await this.repository.closeHargaObat(params.ref_id);
    const created = await this.repository.insertHargaObat({
      obatId: params.ref_id,
      stafId: staf,
      harga: body.harga,
      berlakuDari: body.berlaku_dari,
      alasan
    });
    if (!created) {
      throw ApiError.internal('Gagal menyimpan harga obat');
    }
    return created;
  }

  riwayatHarga(params: RefParams): Promise<Record<string, unknown>[]> {
    return params.ref_tipe === 'LAYANAN'
      ? this.repository.riwayatHargaLayanan(params.ref_id)
      : this.repository.riwayatHargaObat(params.ref_id);
  }
}

export default KeuanganService;

import ApiError from '../errors/ApiError';
import { paginate } from '../validation/common';
import InventarisRepository from '../repositories/inventaris.repository';
import type {
  BatchBody,
  ObatBody,
  ObatUpdateBody,
  ResepPengeluaranBody,
  RestockBody,
  StokListInput
} from '../validation/inventaris';

export class InventarisService {
  constructor(private readonly repository: InventarisRepository = new InventarisRepository()) {}

  list(body: StokListInput): Promise<Record<string, unknown>[]> {
    const term = body.q ? `%${body.q}%` : null;
    return this.repository.listObat(paginate(body.limit, 100, 500), term);
  }

  async createObat(body: ObatBody, stafId: string | null = null): Promise<Record<string, unknown>> {
    if (
      typeof this.repository.countDuplikatKode === 'function' &&
      (await this.repository.countDuplikatKode(body.kode)) > 0
    ) {
      throw ApiError.conflict(`Kode item "${body.kode}" sudah digunakan. Gunakan kode lain.`);
    }
    const duplikat = await this.repository.countDuplikat(body.nama_generik, body.kategori);
    if (duplikat > 0) {
      throw ApiError.fromCode('ERR-INV-03');
    }
    const stokAwal = body.stok_saat_ini ?? body.stok_awal;
    const row = await this.repository.createObat({
      kode: body.kode,
      namaGenerik: body.nama_generik,
      namaDagang: body.nama_dagang,
      kategori: body.kategori,
      bentuk: body.bentuk,
      satuan: body.satuan,
      kekuatan: body.kekuatan,
      golongan: body.golongan,
      stokMinimum: body.stok_minimum,
      ...(stokAwal !== undefined ? { stokSaatIni: stokAwal } : {})
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan obat');
    }

    if (stokAwal && stokAwal > 0 && row.obat_id) {
      const gudangId = this.repository.findDefaultGudang
        ? await this.repository.findDefaultGudang()
        : '1B398758-84BE-E525-4785-7E975D50FEA7';
      const batchId = await this.repository.createBatch({
        obatId: String(row.obat_id),
        noBatch: `INIT-${body.kode}`.slice(0, 30),
        tglKedaluwarsa: '2028-12-31',
        hargaBeli: 0
      });
      if (batchId) {
        await this.repository.addStok(batchId, gudangId, stokAwal);
        await this.repository.addMutasi({
          batchId,
          gudangId,
          stafId,
          jumlah: stokAwal,
          keterangan: 'Penerimaan stok awal master barang'
        });
      }
    }

    return row;
  }

  async updateObat(id: string, body: ObatUpdateBody): Promise<Record<string, unknown>> {
    if (Object.keys(body).length === 0) {
      throw ApiError.validation('Tidak ada perubahan');
    }
    const row = await this.repository.updateObat(id, body as Record<string, unknown>);
    if (!row) {
      throw ApiError.fromCode('ERR-INV-02');
    }
    return row;
  }

  async restock(id: string, body: RestockBody, stafId: string | null): Promise<{ batch_id: string; jumlah: number }> {
    if (!(await this.repository.findObat(id))) {
      throw ApiError.fromCode('ERR-INV-02');
    }
    const gudangId =
      body.gudang_id ||
      (this.repository.findDefaultGudang
        ? await this.repository.findDefaultGudang()
        : '1B398758-84BE-E525-4785-7E975D50FEA7');
    const batchId = await this.repository.createBatch({
      obatId: id,
      noBatch: (body.no_batch || `MUT-${Date.now().toString().slice(-6)}`).slice(0, 30),
      tglKedaluwarsa: body.tgl_kedaluwarsa || '2028-12-31',
      hargaBeli: body.harga_beli ?? 0
    });
    if (!batchId) {
      throw ApiError.internal('Gagal membuat batch obat');
    }

    const jenis = body.jenis ?? 'MASUK';
    if (jenis === 'KELUAR') {
      if (this.repository.reduceStok) {
        await this.repository.reduceStok(batchId, gudangId, body.jumlah, id);
      }
      if (typeof this.repository.adjustStokSaatIni === 'function') {
        await this.repository.adjustStokSaatIni(id, -body.jumlah);
      }
      if (this.repository.addMutasiKeluar) {
        await this.repository.addMutasiKeluar({
          batchId,
          gudangId,
          stafId,
          jumlah: body.jumlah,
          keterangan: body.keterangan ?? 'Pengurangan / pemakaian stok medis'
        });
      }
    } else {
      await this.repository.addStok(batchId, gudangId, body.jumlah);
      if (typeof this.repository.adjustStokSaatIni === 'function') {
        await this.repository.adjustStokSaatIni(id, body.jumlah);
      }
      await this.repository.addMutasi({
        batchId,
        gudangId,
        stafId,
        jumlah: body.jumlah,
        keterangan: body.keterangan ?? 'Restock'
      });
    }

    return { batch_id: batchId, jumlah: body.jumlah };
  }

  listRiwayat(id: string, body: StokListInput): Promise<Record<string, unknown>[]> {
    return this.repository.listRiwayat(id, paginate(body.limit, 100, 500));
  }

  listBatch(id: string): Promise<Record<string, unknown>[]> {
    return this.repository.listBatch(id);
  }

  async createBatch(id: string, body: BatchBody): Promise<{ batch_id: string }> {
    if (!(await this.repository.findObat(id))) {
      throw ApiError.fromCode('ERR-INV-02');
    }
    const batchId = await this.repository.createBatch({
      obatId: id,
      noBatch: body.no_batch,
      tglKedaluwarsa: body.tgl_kedaluwarsa,
      hargaBeli: body.harga_beli
    });
    if (!batchId) {
      throw ApiError.internal('Gagal membuat batch obat');
    }
    await this.repository.insertStok(batchId, body.gudang_id, body.jumlah);
    return { batch_id: batchId };
  }

  listGudang(): Promise<Record<string, unknown>[]> {
    return this.repository.listGudang();
  }

  listStokGudang(id: string): Promise<Record<string, unknown>[]> {
    return this.repository.listStokGudang(id);
  }

  async pengeluaranResep(
    id: string,
    body: ResepPengeluaranBody,
    stafId: string | null
  ): Promise<{ resep_id: string; kode_hasil: number }> {
    if (!stafId) {
      throw ApiError.forbidden('Pengeluaran obat memerlukan akun staf');
    }
    const kode = await this.repository.pengeluaranResep({
      resepId: id,
      gudangId: body.gudang_id,
      stafId,
      kunjunganId: body.kunjungan_id
    });
    if (kode !== 0) {
      throw ApiError.conflict(`Pengeluaran obat gagal (kode ${kode})`);
    }
    await this.repository.markResepDiserahkan(id);
    return { resep_id: id, kode_hasil: kode };
  }
}

export default InventarisService;

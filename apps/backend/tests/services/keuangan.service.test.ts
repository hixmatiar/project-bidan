jest.mock('../../src/db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn(),
    connect: jest.fn()
  },
  SqlConnection: class SqlConnectionStub {}
}));

import { KeuanganService } from '../../src/services/keuangan.service';
import type KeuanganRepository from '../../src/repositories/keuangan.repository';
import { ambilError, ambilErrorSync } from './helpers';

const buatRepo = () => ({
  kunjunganExists: jest.fn().mockResolvedValue(true),
  findPenjaminMandiri: jest.fn(),
  findTagihanIdByKunjungan: jest.fn(),
  createTagihan: jest.fn(),
  listRincian: jest.fn().mockResolvedValue([]),
  findTagihan: jest.fn(),
  createPembayaran: jest.fn().mockResolvedValue(undefined),
  updatePembayaranTagihan: jest.fn(),
  listTagihan: jest.fn().mockResolvedValue([]),
  rekap: jest.fn().mockResolvedValue([]),
  listHargaLayanan: jest.fn().mockResolvedValue([]),
  listHargaObat: jest.fn().mockResolvedValue([]),
  closeHargaLayanan: jest.fn().mockResolvedValue(undefined),
  insertHargaLayanan: jest.fn(),
  closeHargaObat: jest.fn().mockResolvedValue(undefined),
  insertHargaObat: jest.fn(),
  riwayatHargaLayanan: jest.fn().mockResolvedValue([]),
  riwayatHargaObat: jest.fn().mockResolvedValue([])
});

type RepoMock = ReturnType<typeof buatRepo>;

const buatService = (repo: RepoMock) =>
  new KeuanganService(repo as unknown as KeuanganRepository);

describe('KeuanganService', () => {
  let repo: RepoMock;
  let service: KeuanganService;

  beforeEach(() => {
    repo = buatRepo();
    service = buatService(repo);
  });

  test('detailTagihan memakai tagihan yang sudah ada', async () => {
    repo.findTagihanIdByKunjungan.mockResolvedValue('tagihan-1');
    repo.findTagihan.mockResolvedValue({ tagihan_id: 'tagihan-1', total_tagihan: 100 });

    const hasil = await service.detailTagihan('kunjungan-1');

    expect(repo.createTagihan).not.toHaveBeenCalled();
    expect(hasil).toEqual({ tagihan_id: 'tagihan-1', total_tagihan: 100, rincian: [] });
  });

  test('detailTagihan membuat tagihan baru bila belum ada', async () => {
    repo.findTagihanIdByKunjungan.mockResolvedValue(null);
    repo.createTagihan.mockResolvedValue('tagihan-baru');
    repo.findTagihan.mockResolvedValue({ tagihan_id: 'tagihan-baru' });

    await service.detailTagihan('kunjungan-1');

    expect(repo.createTagihan).toHaveBeenCalledWith('kunjungan-1');
    expect(repo.listRincian).toHaveBeenCalledWith('tagihan-baru');
  });

  test('detailTagihan gagal bila tagihan tidak bisa dibuat', async () => {
    repo.findTagihanIdByKunjungan.mockResolvedValue(null);
    repo.createTagihan.mockResolvedValue(null);

    const err = await ambilError(service.detailTagihan('kunjungan-1'));
    expect(err.statusCode).toBe(500);
  });

  test('detailTagihan menolak kunjungan yang tidak ada dengan 404', async () => {
    repo.kunjunganExists.mockResolvedValue(false);

    const err = await ambilError(service.detailTagihan('kunjungan-hantu'));
    expect(err.statusCode).toBe(404);
    expect(repo.createTagihan).not.toHaveBeenCalled();
  });

  test('bayar menolak tagihan yang tidak ditemukan dengan ERR-FIN-02', async () => {
    repo.findTagihan.mockResolvedValue(null);

    const err = await ambilError(
      service.bayar('tagihan-1', { jumlah: 10, metode: 'TUNAI', jenis: 'PENUH' }, 'staf-1')
    );
    expect(err).toMatchObject({ statusCode: 404, errorId: 'ERR-FIN-02' });
  });

  test('bayar menolak akun tanpa data staf dengan 422', async () => {
    const err = await ambilError(
      service.bayar('tagihan-1', { jumlah: 10, metode: 'TUNAI', jenis: 'PENUH' }, null)
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
    expect(repo.findTagihan).not.toHaveBeenCalled();
  });

  test('bayar menolak nominal melebihi sisa dengan ERR-FIN-01', async () => {
    repo.findTagihan.mockResolvedValue({ total_tagihan: 1000, total_dibayar: 400 });

    const err = await ambilError(
      service.bayar('tagihan-1', { jumlah: 700, metode: 'TUNAI', jenis: 'PENUH' }, 'staf-1')
    );
    expect(err).toMatchObject({
      statusCode: 422,
      errorId: 'ERR-FIN-01',
      details: { sisa_tagihan: 600 }
    });
    expect(repo.createPembayaran).not.toHaveBeenCalled();
  });

  test('bayar melunasi tagihan dan mengirim staf kasir', async () => {
    repo.findTagihan.mockResolvedValue({ total_tagihan: 1000, total_dibayar: 400 });
    repo.updatePembayaranTagihan.mockResolvedValue({ tagihan_id: 'tagihan-1', status: 'LUNAS' });

    const hasil = await service.bayar(
      'tagihan-1',
      { jumlah: 600, metode: 'TRANSFER', jenis: 'PENUH', penjamin_id: 'penjamin-1' },
      'staf-kasir'
    );

    expect(repo.createPembayaran).toHaveBeenCalledWith({
      tagihanId: 'tagihan-1',
      penjaminId: 'penjamin-1',
      kasirStafId: 'staf-kasir',
      jumlah: 600,
      metode: 'TRANSFER',
      jenis: 'PENUH'
    });
    expect(repo.updatePembayaranTagihan).toHaveBeenCalledWith('tagihan-1', 1000, 'LUNAS');
    expect(hasil).toEqual({ tagihan_id: 'tagihan-1', status: 'LUNAS' });
  });

  test('bayar sebagian memakai status BAYAR_SEBAGIAN dan penjamin Mandiri default', async () => {
    repo.findTagihan.mockResolvedValue({ total_tagihan: 1000, total_dibayar: 0 });
    repo.findPenjaminMandiri.mockResolvedValue('penjamin-mandiri');
    repo.updatePembayaranTagihan.mockResolvedValue({ tagihan_id: 'tagihan-1' });

    await service.bayar('tagihan-1', { jumlah: 250, metode: 'TUNAI', jenis: 'SEBAGIAN' }, 'staf-1');

    expect(repo.createPembayaran).toHaveBeenCalledWith(
      expect.objectContaining({ penjaminId: 'penjamin-mandiri', kasirStafId: 'staf-1' })
    );
    expect(repo.updatePembayaranTagihan).toHaveBeenCalledWith('tagihan-1', 250, 'BAYAR_SEBAGIAN');
  });

  test('list menolak periode terbalik dengan ERR-VAL-01', () => {
    const err = ambilErrorSync(() => service.list({ dari: '2026-02-01', sampai: '2026-01-01' }));
    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
  });

  test('list membatasi limit maksimal 500', () => {
    service.list({ limit: 9999 });

    expect(repo.listTagihan).toHaveBeenCalledWith(500, null, null, null);
  });

  test('rekap meneruskan periode valid', () => {
    service.rekap({ dari: '2026-01-01', sampai: '2026-02-01' });
    expect(repo.rekap).toHaveBeenCalledWith('2026-01-01', '2026-02-01');
  });

  test('rekap menolak rentang lebih dari 366 hari', () => {
    const err = ambilErrorSync(() => service.rekap({ dari: '2025-01-01', sampai: '2026-06-01' }));
    expect(err.errorId).toBe('ERR-VAL-01');
  });

  test('setHarga menolak harga nol dengan ERR-PRC-01', async () => {
    const err = await ambilError(
      service.setHarga(
        { ref_tipe: 'LAYANAN', ref_id: 'ref-1' },
        { harga: 0, alasan: 'penyesuaian' },
        'staf-1'
      )
    );
    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-PRC-01' });
  });

  test('setHarga menolak tanggal berlaku mundur', async () => {
    const err = await ambilError(
      service.setHarga(
        { ref_tipe: 'OBAT', ref_id: 'ref-1' },
        { harga: 1000, berlaku_dari: '2000-01-01', alasan: 'penyesuaian' },
        'staf-1'
      )
    );
    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-PRC-01' });
  });

  test('setHarga menolak alasan kosong dengan ERR-VAL-01', async () => {
    const err = await ambilError(
      service.setHarga(
        { ref_tipe: 'OBAT', ref_id: 'ref-1' },
        { harga: 1000, alasan: '  ' },
        'staf-1'
      )
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
  });

  test('setHarga layanan menutup harga lama lalu menyimpan harga baru', async () => {
    repo.insertHargaLayanan.mockResolvedValue({ harga_id: 'harga-1' });

    const hasil = await service.setHarga(
      { ref_tipe: 'LAYANAN', ref_id: 'layanan-1' },
      { harga: 50000, kelas_id: 'kelas-1', penjamin_id: 'penjamin-1', alasan: 'penyesuaian' },
      'staf-1'
    );

    expect(repo.closeHargaLayanan).toHaveBeenCalledWith('layanan-1');
    expect(repo.insertHargaLayanan).toHaveBeenCalledWith({
      layananId: 'layanan-1',
      kelasId: 'kelas-1',
      penjaminId: 'penjamin-1',
      stafId: 'staf-1',
      harga: 50000,
      berlakuDari: undefined,
      alasan: 'penyesuaian'
    });
    expect(hasil).toEqual({ harga_id: 'harga-1' });
  });

  test('setHarga obat memakai jalur obat', async () => {
    repo.insertHargaObat.mockResolvedValue({ harga_id: 'harga-obat' });

    await service.setHarga(
      { ref_tipe: 'OBAT', ref_id: 'obat-1' },
      { harga: 12000, alasan: 'penyesuaian' },
      'staf-1'
    );

    expect(repo.closeHargaObat).toHaveBeenCalledWith('obat-1');
    expect(repo.insertHargaLayanan).not.toHaveBeenCalled();
  });

  test('riwayatHarga memilih repository sesuai ref_tipe', async () => {
    await service.riwayatHarga({ ref_tipe: 'LAYANAN', ref_id: 'layanan-1' });
    await service.riwayatHarga({ ref_tipe: 'OBAT', ref_id: 'obat-1' });

    expect(repo.riwayatHargaLayanan).toHaveBeenCalledWith('layanan-1');
    expect(repo.riwayatHargaObat).toHaveBeenCalledWith('obat-1');
  });
});

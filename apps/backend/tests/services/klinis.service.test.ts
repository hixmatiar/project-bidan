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

import { KlinisService } from '../../src/services/klinis.service';
import type KlinisRepository from '../../src/repositories/klinis.repository';
import { ambilError } from './helpers';

const buatRepo = () => ({
  findDokterAktif: jest.fn(),
  findPenjaminPertama: jest.fn(),
  createKunjungan: jest.fn(),
  upsertDiagnosa: jest.fn().mockResolvedValue(undefined),
  insertTindakan: jest.fn().mockResolvedValue(undefined),
  createCatatan: jest.fn(),
  listKehamilan: jest.fn().mockResolvedValue([]),
  createKehamilan: jest.fn(),
  listAnc: jest.fn().mockResolvedValue([]),
  createAnc: jest.fn(),
  createPersalinan: jest.fn(),
  completeKehamilan: jest.fn().mockResolvedValue(undefined),
  createPasienBayi: jest.fn(),
  createBayiLahir: jest.fn(),
  listImunisasi: jest.fn().mockResolvedValue([]),
  createImunisasi: jest.fn(),
  listKb: jest.fn().mockResolvedValue([]),
  createKb: jest.fn()
});

type RepoMock = ReturnType<typeof buatRepo>;

const buatService = (repo: RepoMock) => new KlinisService(repo as unknown as KlinisRepository);

const kunjunganBody = {
  unit_id: 'unit-1',
  jenis_kunjungan: 'RAWAT_JALAN',
  diagnosa: [{ kode_icd: 'A09', nama: 'Diare', jenis: 'UTAMA' as const }],
  layanan_ids: ['layanan-1']
};

describe('KlinisService', () => {
  let repo: RepoMock;
  let service: KlinisService;

  beforeEach(() => {
    repo = buatRepo();
    service = buatService(repo);
  });

  test('createKunjungan menolak bila DPJP tidak tersedia', async () => {
    repo.findDokterAktif.mockResolvedValue(null);
    repo.findPenjaminPertama.mockResolvedValue('penjamin-1');

    const err = await ambilError(service.createKunjungan('pasien-1', kunjunganBody, { stafId: null }));

    expect(err.statusCode).toBe(400);
    expect(repo.createKunjungan).not.toHaveBeenCalled();
  });

  test('createKunjungan menolak bila penjamin tidak tersedia', async () => {
    repo.findPenjaminPertama.mockResolvedValue(null);

    const err = await ambilError(
      service.createKunjungan('pasien-1', kunjunganBody, { stafId: 'staf-1' })
    );

    expect(err.statusCode).toBe(400);
  });

  test('createKunjungan menolak akun yang tidak terhubung staf', async () => {
    repo.findDokterAktif.mockResolvedValue('dokter-1');
    repo.findPenjaminPertama.mockResolvedValue('penjamin-1');
    repo.createKunjungan.mockResolvedValue('kunjungan-1');

    const err = await ambilError(service.createKunjungan('pasien-1', kunjunganBody, { stafId: null }));

    expect(err.statusCode).toBe(400);
    expect(repo.createKunjungan).toHaveBeenCalled();
  });

  test('createKunjungan sukses menyimpan diagnosa dan layanan unik', async () => {
    repo.findPenjaminPertama.mockResolvedValue('penjamin-1');
    repo.createKunjungan.mockResolvedValue('kunjungan-1');

    const hasil = await service.createKunjungan(
      'pasien-1',
      { ...kunjunganBody, layanan_ids: ['layanan-1', 'layanan-1', 'layanan-2'] },
      { stafId: 'staf-1' }
    );

    expect(repo.upsertDiagnosa).toHaveBeenCalledWith('kunjungan-1', 'A09', 'Diare', 'UTAMA');
    expect(repo.insertTindakan).toHaveBeenCalledWith('kunjungan-1', ['layanan-1', 'layanan-2'], 'staf-1');
    expect(hasil).toEqual({ kunjungan_id: 'kunjungan-1' });
  });

  test('createCatatan mengembalikan 500 bila gagal simpan', async () => {
    repo.createCatatan.mockResolvedValue(null);

    const err = await ambilError(
      service.createCatatan('kunjungan-1', { jenis: 'CPPT', isi: 'observasi' }, 'staf-1')
    );

    expect(err.statusCode).toBe(500);
  });

  test('createPersalinan menandai kehamilan selesai', async () => {
    repo.createPersalinan.mockResolvedValue({ persalinan_id: 'persalinan-1' });

    await service.createPersalinan(
      'kehamilan-1',
      { kunjungan_id: 'kunjungan-1', jenis_persalinan: 'NORMAL', kondisi_ibu: 'STABIL' },
      { stafId: 'staf-1' }
    );

    expect(repo.createPersalinan).toHaveBeenCalledWith(
      expect.objectContaining({ kehamilanId: 'kehamilan-1', penolongId: 'staf-1' })
    );
    expect(repo.completeKehamilan).toHaveBeenCalledWith('kehamilan-1');
  });

  test('createPersalinan menolak kunjungan atau penolong kosong dengan 422', async () => {
    const err = await ambilError(
      service.createPersalinan(
        'kehamilan-1',
        { kunjungan_id: undefined, jenis_persalinan: 'NORMAL', kondisi_ibu: 'STABIL' } as never,
        { stafId: null }
      )
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
    expect(repo.createPersalinan).not.toHaveBeenCalled();
  });

  test('createBayi menolak bila pasien bayi gagal dibuat', async () => {
    repo.createPasienBayi.mockResolvedValue(null);

    const err = await ambilError(
      service.createBayi('persalinan-1', {
        berat_lahir_gram: 3000,
        panjang_lahir_cm: 48,
        kondisi: 'SEHAT',
        nama: 'Bayi Uji',
        jenis_kelamin: 'PEREMPUAN',
        tgl_lahir: '2026-11-20',
        ibu_pasien_id: 'pasien-ibu'
      })
    );

    expect(err.statusCode).toBe(500);
    expect(repo.createBayiLahir).not.toHaveBeenCalled();
  });

  test('createImunisasi mengembalikan 500 bila gagal simpan', async () => {
    repo.createImunisasi.mockResolvedValue(null);

    const err = await ambilError(
      service.createImunisasi(
        'pasien-1',
        { vaksin_id: 'vaksin-1', kunjungan_id: 'kunjungan-1', dosis_ke: 1, tanggal: '2026-11-20' },
        'staf-1'
      )
    );

    expect(err.statusCode).toBe(500);
  });

  test('createImunisasi menolak akun tanpa data staf dengan 422', async () => {
    const err = await ambilError(
      service.createImunisasi(
        'pasien-1',
        { vaksin_id: 'vaksin-1', kunjungan_id: 'kunjungan-1', dosis_ke: 1, tanggal: '2026-11-20' },
        null
      )
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
    expect(repo.createImunisasi).not.toHaveBeenCalled();
  });

  test('createKb mengembalikan 500 bila gagal simpan', async () => {
    repo.createKb.mockResolvedValue(null);

    const err = await ambilError(
      service.createKb('pasien-1', {
        metode_id: 'metode-1',
        kunjungan_id: 'kunjungan-1',
        tanggal: '2026-11-20'
      })
    );

    expect(err.statusCode).toBe(500);
  });

  test('createKb menolak kunjungan kosong dengan 422', async () => {
    const err = await ambilError(
      service.createKb('pasien-1', {
        metode_id: 'metode-1',
        kunjungan_id: undefined,
        tanggal: '2026-11-20'
      } as never)
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
    expect(repo.createKb).not.toHaveBeenCalled();
  });

  test('listAnc membatasi limit maksimal 200', () => {
    service.listAnc('pasien-1', { limit: 9999 });

    expect(repo.listAnc).toHaveBeenCalledWith('pasien-1', 200);
  });
});

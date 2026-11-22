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

import bcrypt from 'bcryptjs';
import { AdminService } from '../../src/services/admin.service';
import type AdminRepository from '../../src/repositories/admin.repository';
import { ambilError } from './helpers';

const buatRepo = () => ({
  findStaf: jest.fn(),
  findPeranId: jest.fn(),
  countUsername: jest.fn().mockResolvedValue(0),
  createAkun: jest.fn(),
  createPemeliharaan: jest.fn(),
  enqueueKalibrasi: jest.fn().mockResolvedValue(undefined)
});

type RepoMock = ReturnType<typeof buatRepo>;

const buatService = (repo: RepoMock) => new AdminService(repo as unknown as AdminRepository);

const akunBody = {
  username: 'perawat01',
  password: 'rahasia123',
  peran: 'STAFF' as const,
  sub_peran: 'PERAWAT' as const
};

describe('AdminService', () => {
  let repo: RepoMock;
  let service: AdminService;

  beforeEach(() => {
    repo = buatRepo();
    service = buatService(repo);
  });

  test('createAkun menolak STAFF tanpa sub_peran', async () => {
    const err = await ambilError(
      service.createAkun('staf-1', { username: 'perawat01', password: 'rahasia123', peran: 'STAFF' })
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
  });

  test('createAkun menolak sub_peran untuk peran non-STAFF', async () => {
    const err = await ambilError(
      service.createAkun('staf-1', {
        username: 'dokter01',
        password: 'rahasia123',
        peran: 'DOKTER',
        sub_peran: 'PERAWAT'
      })
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
  });

  test('createAkun menolak staf yang tidak ditemukan', async () => {
    repo.findStaf.mockResolvedValue(null);

    const err = await ambilError(service.createAkun('staf-1', akunBody));

    expect(err.statusCode).toBe(404);
  });

  test('createAkun menolak peran yang tidak ada di master', async () => {
    repo.findStaf.mockResolvedValue({ staf_id: 'staf-1' });
    repo.findPeranId.mockResolvedValue(null);

    const err = await ambilError(service.createAkun('staf-1', akunBody));

    expect(err.statusCode).toBe(400);
  });

  test('createAkun menolak username duplikat', async () => {
    repo.findStaf.mockResolvedValue({ staf_id: 'staf-1' });
    repo.findPeranId.mockResolvedValue('peran-1');
    repo.countUsername.mockResolvedValue(1);

    const err = await ambilError(service.createAkun('staf-1', akunBody));

    expect(err.statusCode).toBe(409);
    expect(repo.createAkun).not.toHaveBeenCalled();
  });

  test('createAkun menyimpan kata sandi dalam bentuk hash', async () => {
    repo.findStaf.mockResolvedValue({ staf_id: 'staf-1' });
    repo.findPeranId.mockResolvedValue('peran-1');
    repo.createAkun.mockResolvedValue({ akun_id: 'akun-1' });

    await service.createAkun('staf-1', akunBody);

    const dikirim = repo.createAkun.mock.calls[0]?.[0] as { passwordHash: string };
    expect(dikirim.passwordHash).not.toBe(akunBody.password);
    await expect(bcrypt.compare(akunBody.password, dikirim.passwordHash)).resolves.toBe(true);
  });

  test('createPemeliharaan menjadwalkan kalibrasi bila tanggal diisi', async () => {
    repo.createPemeliharaan.mockResolvedValue({ pemeliharaan_id: 'pem-1' });

    await service.createPemeliharaan('aset-1', {
      teknisi_staf_id: 'staf-teknisi',
      jenis: 'KALIBRASI',
      tanggal: '2026-11-20',
      biaya: 100000,
      jadwal_berikutnya: '2027-05-20'
    });

    expect(repo.enqueueKalibrasi).toHaveBeenCalledWith('aset-1', '2027-05-20');
  });

  test('createPemeliharaan mengembalikan 500 bila gagal simpan', async () => {
    repo.createPemeliharaan.mockResolvedValue(null);

    const err = await ambilError(
      service.createPemeliharaan('aset-1', {
        teknisi_staf_id: 'staf-teknisi',
        jenis: 'RUTIN',
        tanggal: '2026-11-20',
        biaya: 0
      })
    );

    expect(err.statusCode).toBe(500);
  });

  test('createPemeliharaan menolak teknisi kosong dengan 422', async () => {
    const err = await ambilError(
      service.createPemeliharaan('aset-1', {
        teknisi_staf_id: '',
        jenis: 'RUTIN',
        tanggal: '2026-11-20',
        biaya: 0
      })
    );

    expect(err).toMatchObject({ statusCode: 422, errorId: 'ERR-VAL-01' });
    expect(repo.createPemeliharaan).not.toHaveBeenCalled();
  });
});

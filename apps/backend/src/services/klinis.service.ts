import ApiError from '../errors/ApiError';
import { paginate } from '../validation/common';
import KlinisRepository from '../repositories/klinis.repository';
import type {
  AncBody,
  CatatanBody,
  ImunisasiBody,
  KbBody,
  KehamilanBody,
  KlinisBayiBody,
  KunjunganBody,
  LimitInput,
  PersalinanBody
} from '../validation/klinis';

export class KlinisService {
  constructor(private readonly repository: KlinisRepository = new KlinisRepository()) {}

  private pastikanNilai(
    nilai: string | null | undefined,
    path: string,
    pesan: string
  ): string {
    if (!nilai) {
      throw ApiError.validation('Validasi gagal', [{ path: [path], message: pesan }]);
    }
    return nilai;
  }

  async createKunjungan(
    pasienId: string,
    body: KunjunganBody,
    auth: { stafId: string | null } | undefined
  ): Promise<{ kunjungan_id: string }> {
    const dpjp = body.dpjp_staf_id ?? auth?.stafId ?? (await this.repository.findDokterAktif());
    const penjamin = body.penjamin_id ?? (await this.repository.findPenjaminPertama());
    if (!dpjp || !penjamin) {
      throw ApiError.badRequest('DPJP atau penjamin tidak tersedia');
    }

    const kunjunganId = await this.repository.createKunjungan({
      pasienId,
      unitId: body.unit_id,
      dpjpId: dpjp,
      penjaminId: penjamin,
      jenis: body.jenis_kunjungan
    });
    if (!kunjunganId) {
      throw ApiError.internal('Gagal membuat kunjungan');
    }

    for (const diagnosa of body.diagnosa) {
      await this.repository.upsertDiagnosa(kunjunganId, diagnosa.kode_icd, diagnosa.nama, diagnosa.jenis);
    }

    const pelaksana = auth?.stafId ?? null;
    if (!pelaksana) {
      throw ApiError.badRequest('Akun tidak terhubung ke staf');
    }

    const layananIds = [...new Set(body.layanan_ids)];
    if (layananIds.length > 0) {
      await this.repository.insertTindakan(kunjunganId, layananIds, pelaksana);
    }

    return { kunjungan_id: kunjunganId };
  }

  async createCatatan(id: string, body: CatatanBody, stafId: string | null): Promise<Record<string, unknown>> {
    const row = await this.repository.createCatatan({
      kunjunganId: id,
      stafId,
      jenis: body.jenis,
      isi: body.isi
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan catatan');
    }
    return row;
  }

  listKehamilan(id: string, body: LimitInput): Promise<Record<string, unknown>[]> {
    return this.repository.listKehamilan(id, paginate(body.limit, 50, 200));
  }

  async createKehamilan(id: string, body: KehamilanBody): Promise<Record<string, unknown>> {
    const row = await this.repository.createKehamilan(id, {
      hpht: body.hpht,
      gravida: body.gravida,
      paritas: body.paritas,
      abortus: body.abortus,
      statusRisiko: body.status_risiko,
      status: body.status
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan data kehamilan');
    }
    return row;
  }

  listAnc(id: string, body: LimitInput): Promise<Record<string, unknown>[]> {
    return this.repository.listAnc(id, paginate(body.limit, 50, 200));
  }

  async createAnc(id: string, body: AncBody): Promise<Record<string, unknown>> {
    const row = await this.repository.createAnc(id, {
      kunjunganKe: body.kunjungan_ke,
      minggu: body.usia_kehamilan_minggu,
      tinggiFundus: body.tinggi_fundus,
      djj: body.djj,
      letakJanin: body.letak_janin,
      tabletFe: body.tablet_fe_diberikan
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan pemeriksaan ANC');
    }
    return row;
  }

  async createPersalinan(
    id: string,
    body: PersalinanBody,
    auth: { stafId: string | null } | undefined
  ): Promise<Record<string, unknown>> {
    const kunjunganId = this.pastikanNilai(
      body.kunjungan_id,
      'kunjungan_id',
      'kunjungan_id wajib diisi saat mencatat persalinan'
    );
    const penolongId = this.pastikanNilai(
      body.penolong_staf_id ?? auth?.stafId ?? null,
      'penolong_staf_id',
      'penolong_staf_id wajib diisi atau akun harus terhubung ke data staf'
    );

    const row = await this.repository.createPersalinan({
      kehamilanId: id,
      kunjunganId,
      penolongId,
      waktu: body.waktu_persalinan,
      jenis: body.jenis_persalinan,
      komplikasi: body.komplikasi,
      kondisiIbu: body.kondisi_ibu
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan data persalinan');
    }
    await this.repository.completeKehamilan(id);
    return row;
  }

  async createBayi(id: string, body: KlinisBayiBody): Promise<Record<string, unknown>> {
    const pasienId = await this.repository.createPasienBayi({
      nama: body.nama,
      jenisKelamin: body.jenis_kelamin,
      tglLahir: body.tgl_lahir,
      ibuPasienId: body.ibu_pasien_id
    });
    if (!pasienId) {
      throw ApiError.internal('Gagal membuat data pasien bayi');
    }
    const row = await this.repository.createBayiLahir(
      {
        persalinanId: id,
        berat: body.berat_lahir_gram,
        panjang: body.panjang_lahir_cm,
        apgar1: body.apgar_1,
        apgar5: body.apgar_5,
        kondisi: body.kondisi,
        nama: body.nama,
        jenisKelamin: body.jenis_kelamin,
        tglLahir: body.tgl_lahir,
        ibuPasienId: body.ibu_pasien_id
      },
      pasienId
    );
    if (!row) {
      throw ApiError.internal('Gagal menyimpan data bayi');
    }
    return row;
  }

  listImunisasi(id: string, body: LimitInput): Promise<Record<string, unknown>[]> {
    return this.repository.listImunisasi(id, paginate(body.limit, 50, 200));
  }

  async createImunisasi(
    id: string,
    body: ImunisasiBody,
    stafId: string | null
  ): Promise<Record<string, unknown>> {
    const kunjunganId = this.pastikanNilai(
      body.kunjungan_id,
      'kunjungan_id',
      'kunjungan_id wajib diisi saat mencatat imunisasi'
    );
    const staf = this.pastikanNilai(
      stafId,
      'staf_id',
      'Akun ini tidak terhubung ke data staf'
    );

    const row = await this.repository.createImunisasi({
      pasienId: id,
      vaksinId: body.vaksin_id,
      kunjunganId,
      batchId: body.batch_id,
      stafId: staf,
      dosisKe: body.dosis_ke,
      tanggal: body.tanggal
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan imunisasi');
    }
    return row;
  }

  listKb(id: string, body: LimitInput): Promise<Record<string, unknown>[]> {
    return this.repository.listKb(id, paginate(body.limit, 50, 200));
  }

  async createKb(id: string, body: KbBody): Promise<Record<string, unknown>> {
    const kunjunganId = this.pastikanNilai(
      body.kunjungan_id,
      'kunjungan_id',
      'kunjungan_id wajib diisi saat mencatat pelayanan KB'
    );

    const row = await this.repository.createKb({
      pasienId: id,
      metodeId: body.metode_id,
      kunjunganId,
      tanggal: body.tanggal,
      kontrolBerikutnya: body.kontrol_berikutnya,
      efekSamping: body.efek_samping
    });
    if (!row) {
      throw ApiError.internal('Gagal menyimpan pelayanan KB');
    }
    return row;
  }
}

export default KlinisService;

import { z } from 'zod';
import { uuidSchema } from './common';
import type { MasterConfig } from '../repositories/master.repository';
import type { Profile } from '../types';
import { ADMIN_LOKAL, P, SEMUA_STAF } from '../auth/profiles';

export interface MasterField {
  schema: z.ZodType;
  required?: boolean;
}

export interface MasterDefinition {
  path: string;
  config: MasterConfig;
  fields: Record<string, MasterField>;
  read: Profile[];
  create?: Profile[];
  update?: Profile[];
}

const uuid = (): z.ZodType => uuidSchema;
const text = (max = 255): z.ZodType => z.string().min(1).max(max);
const optionalText = (max = 255): z.ZodType => z.string().max(max);
const integer = (): z.ZodType => z.number().int();
const decimal = (): z.ZodType => z.number();
const bool = (): z.ZodType => z.boolean();
const date = (): z.ZodType => z.string().max(40);
const email = (): z.ZodType => z.string().email().max(254);

const field = (schema: z.ZodType, required = false): MasterField => ({ schema, required });

const KODE = () => field(text(30), true);
const NAMA = () => field(text(150), true);
const AKTIF = () => field(bool());
const UUID_OPT = () => field(uuid());
const TEXT_OPT = (max = 255) => field(optionalText(max));

export const createMasterSchema = (definition: MasterDefinition): z.ZodObject<Record<string, z.ZodType>> =>
  z.object(
    Object.fromEntries(
      Object.entries(definition.fields).map(([name, spec]) => [
        name,
        spec.required ? spec.schema : spec.schema.optional()
      ])
    )
  );

export const updateMasterSchema = (definition: MasterDefinition): z.ZodObject<Record<string, z.ZodType>> =>
  z.object(
    Object.fromEntries(Object.entries(definition.fields).map(([name, spec]) => [name, spec.schema.optional()]))
  );

export const masterListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

/**
 * Definisi seluruh endpoint master. Urutan dan role mengikuti TSD Bagian 3.2.
 * `create`/`update` tidak diisi berarti endpoint tersebut tidak didaftarkan.
 */
export const MASTER_DEFINITIONS: MasterDefinition[] = [
  {
    path: '/unit-pelayanan',
    config: {
      table: '[Unit_Pelayanan]',
      pk: 'unit_id',
      columns: ['rumah_sakit_id', 'induk_unit_id', 'kepala_staf_id', 'kode', 'nama', 'jenis', 'aktif'],
      orderBy: 'nama'
    },
    fields: {
      rumah_sakit_id: UUID_OPT(),
      induk_unit_id: UUID_OPT(),
      kepala_staf_id: UUID_OPT(),
      kode: KODE(),
      nama: NAMA(),
      jenis: field(text(30), true),
      aktif: AKTIF()
    },
    read: SEMUA_STAF,
    create: [P.SUPERADMIN]
  },
  {
    path: '/ruangan',
    config: {
      table: '[Ruangan]',
      pk: 'ruangan_id',
      columns: ['unit_id', 'gedung_id', 'kode', 'nama', 'jenis', 'lantai', 'kapasitas', 'status'],
      orderBy: 'nama'
    },
    fields: {
      unit_id: UUID_OPT(),
      gedung_id: UUID_OPT(),
      kode: KODE(),
      nama: NAMA(),
      jenis: field(text(30), true),
      lantai: field(integer()),
      kapasitas: field(integer()),
      status: TEXT_OPT(20)
    },
    read: SEMUA_STAF,
    create: ADMIN_LOKAL
  },
  {
    path: '/kelas-perawatan',
    config: {
      table: '[Kelas_Perawatan]',
      pk: 'kelas_id',
      columns: ['kode', 'nama', 'urutan'],
      orderBy: 'urutan'
    },
    fields: {
      kode: KODE(),
      nama: NAMA(),
      urutan: field(integer(), true)
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.PERAWAT, P.RESEPSIONIS]
  },
  {
    path: '/layanan',
    config: {
      table: '[Layanan_Medis]',
      pk: 'layanan_id',
      columns: ['unit_id', 'kode', 'nama', 'kategori', 'satuan', 'kode_icd9', 'aktif'],
      orderBy: 'nama'
    },
    fields: {
      unit_id: UUID_OPT(),
      kode: KODE(),
      nama: NAMA(),
      kategori: field(text(30), true),
      satuan: TEXT_OPT(20),
      kode_icd9: TEXT_OPT(20),
      aktif: AKTIF()
    },
    read: SEMUA_STAF,
    create: ADMIN_LOKAL,
    update: ADMIN_LOKAL
  },
  {
    path: '/paket-layanan',
    config: {
      table: '[Paket_Layanan]',
      pk: 'paket_id',
      columns: ['kode', 'nama', 'jenis', 'aktif'],
      orderBy: 'nama'
    },
    fields: {
      kode: KODE(),
      nama: NAMA(),
      jenis: field(text(30), true),
      aktif: AKTIF()
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.RESEPSIONIS],
    create: ADMIN_LOKAL
  },
  {
    path: '/penjamin',
    config: {
      table: '[Penjamin]',
      pk: 'penjamin_id',
      columns: ['nama', 'jenis', 'no_kontrak', 'kontak', 'aktif'],
      orderBy: 'nama'
    },
    fields: {
      nama: NAMA(),
      jenis: field(text(30), true),
      no_kontrak: TEXT_OPT(50),
      kontak: TEXT_OPT(100),
      aktif: AKTIF()
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.PERAWAT, P.RESEPSIONIS]
  },
  {
    path: '/pemasok',
    config: {
      table: '[Pemasok]',
      pk: 'pemasok_id',
      columns: ['nama', 'alamat', 'kontak', 'npwp', 'aktif'],
      orderBy: 'nama'
    },
    fields: {
      nama: NAMA(),
      alamat: TEXT_OPT(255),
      kontak: TEXT_OPT(100),
      npwp: TEXT_OPT(30),
      aktif: AKTIF()
    },
    read: ADMIN_LOKAL,
    create: ADMIN_LOKAL
  },
  {
    path: '/master/vaksin',
    config: {
      table: '[Vaksin]',
      pk: 'vaksin_id',
      columns: ['obat_id', 'nama', 'jumlah_dosis_standar', 'usia_anjuran'],
      orderBy: 'nama'
    },
    fields: {
      obat_id: UUID_OPT(),
      nama: NAMA(),
      jumlah_dosis_standar: field(integer()),
      usia_anjuran: TEXT_OPT(50)
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.PERAWAT]
  },
  {
    path: '/master/metode-kb',
    config: {
      table: '[Metode_KB]',
      pk: 'metode_id',
      columns: ['obat_id', 'nama', 'jenis'],
      orderBy: 'nama'
    },
    fields: {
      obat_id: UUID_OPT(),
      nama: NAMA(),
      jenis: field(text(30), true)
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.PERAWAT]
  },
  {
    path: '/master/parameter-lab',
    config: {
      table: '[Parameter_Lab]',
      pk: 'parameter_id',
      columns: ['layanan_id', 'nama', 'satuan', 'nilai_rujukan_min', 'nilai_rujukan_maks'],
      orderBy: 'nama'
    },
    fields: {
      layanan_id: UUID_OPT(),
      nama: NAMA(),
      satuan: TEXT_OPT(20),
      nilai_rujukan_min: field(decimal()),
      nilai_rujukan_maks: field(decimal())
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.PERAWAT]
  },
  {
    path: '/pemulasaran',
    config: {
      table: '[Pemulasaran_Jenazah]',
      pk: 'pemulasaran_id',
      columns: [
        'pasien_id',
        'kunjungan_id',
        'ruangan_id',
        'staf_id',
        'waktu_meninggal',
        'penyebab',
        'waktu_masuk',
        'waktu_diserahkan',
        'penerima'
      ],
      orderBy: 'waktu_meninggal'
    },
    fields: {
      pasien_id: field(uuid(), true),
      kunjungan_id: UUID_OPT(),
      ruangan_id: UUID_OPT(),
      staf_id: UUID_OPT(),
      waktu_meninggal: field(date(), true),
      penyebab: TEXT_OPT(255),
      waktu_masuk: field(date()),
      waktu_diserahkan: field(date()),
      penerima: TEXT_OPT(100)
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.PERAWAT, P.RESEPSIONIS],
    create: [P.SUPERADMIN, P.ADMIN_LOKAL, P.PERAWAT, P.RESEPSIONIS]
  },
  {
    path: '/aset',
    config: {
      table: '[Aset]',
      pk: 'aset_id',
      columns: ['ruangan_id', 'kode', 'nama', 'kategori', 'tgl_perolehan', 'harga_perolehan', 'kondisi', 'status'],
      orderBy: 'nama'
    },
    fields: {
      ruangan_id: UUID_OPT(),
      kode: KODE(),
      nama: NAMA(),
      kategori: field(text(30), true),
      tgl_perolehan: field(date()),
      harga_perolehan: field(decimal()),
      kondisi: TEXT_OPT(30),
      status: TEXT_OPT(30)
    },
    read: ADMIN_LOKAL,
    create: ADMIN_LOKAL
  },
  {
    path: '/klaim-penjamin',
    config: {
      table: '[Klaim_Penjamin]',
      pk: 'klaim_id',
      columns: [
        'tagihan_id',
        'penjamin_id',
        'no_sep',
        'kode_grup_tarif',
        'tarif_klaim',
        'status',
        'tgl_ajuan',
        'tgl_dibayar'
      ],
      orderBy: 'tgl_ajuan'
    },
    fields: {
      tagihan_id: field(uuid(), true),
      penjamin_id: field(uuid(), true),
      no_sep: TEXT_OPT(50),
      kode_grup_tarif: TEXT_OPT(30),
      tarif_klaim: field(decimal()),
      status: TEXT_OPT(30),
      tgl_ajuan: field(date()),
      tgl_dibayar: field(date())
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.RESEPSIONIS],
    update: [P.SUPERADMIN, P.ADMIN_LOKAL, P.RESEPSIONIS]
  },
  {
    path: '/insiden',
    config: {
      table: '[Laporan_Insiden]',
      pk: 'insiden_id',
      columns: [
        'kunjungan_id',
        'unit_id',
        'pelapor_staf_id',
        'jenis',
        'tingkat_keparahan',
        'deskripsi',
        'tindak_lanjut',
        'status',
        'tgl'
      ],
      orderBy: 'tgl'
    },
    fields: {
      kunjungan_id: UUID_OPT(),
      unit_id: UUID_OPT(),
      pelapor_staf_id: UUID_OPT(),
      jenis: field(text(50), true),
      tingkat_keparahan: TEXT_OPT(30),
      deskripsi: field(text(2000), true),
      tindak_lanjut: TEXT_OPT(2000),
      status: TEXT_OPT(30),
      tgl: field(date())
    },
    read: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.PERAWAT, P.RESEPSIONIS],
    create: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER, P.PERAWAT, P.RESEPSIONIS],
    update: [P.SUPERADMIN, P.ADMIN_LOKAL, P.DOKTER]
  },
  {
    path: '/staf',
    config: {
      table: '[Staf]',
      pk: 'staf_id',
      columns: [
        'nip',
        'nama',
        'jenis_kelamin',
        'tgl_lahir',
        'no_telepon',
        'alamat',
        'profesi_id',
        'unit_id',
        'jabatan',
        'status_kepegawaian',
        'tgl_masuk',
        'aktif',
        'email'
      ],
      orderBy: 'nama'
    },
    fields: {
      nip: field(text(30), true),
      nama: NAMA(),
      jenis_kelamin: field(text(20), true),
      tgl_lahir: field(date()),
      no_telepon: TEXT_OPT(20),
      alamat: TEXT_OPT(255),
      profesi_id: field(uuid(), true),
      unit_id: UUID_OPT(),
      jabatan: TEXT_OPT(100),
      status_kepegawaian: TEXT_OPT(30),
      tgl_masuk: field(date()),
      aktif: AKTIF(),
      email: field(email())
    },
    read: ADMIN_LOKAL,
    create: ADMIN_LOKAL,
    update: ADMIN_LOKAL
  }
];

export default MASTER_DEFINITIONS;

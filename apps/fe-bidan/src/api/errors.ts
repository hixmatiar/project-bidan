import axios from 'axios';
import type { ApiErrorBody } from './types';

interface ValidationDetail {
  path?: Array<string | number>;
  message?: string;
}

const detailMessages = (details: unknown): string[] => {
  if (!Array.isArray(details)) return [];
  return details.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const detail = item as ValidationDetail;
    if (typeof detail.message !== 'string' || detail.message.length === 0) return [];
    const path = Array.isArray(detail.path) ? detail.path.join('.') : '';
    return [path ? `${path}: ${detail.message}` : detail.message];
  });
};

/**
 * Mengubah pesan error teknis menjadi bahasa manusia yang ramah bagi pengguna/pasien
 */
const translateTechnicalError = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (lower.includes('jadwal_id') || lower.includes('sesi_id') || lower.includes('jadwal slot')) {
    return 'Tolong pilih sesi jadwal terlebih dahulu.';
  }
  if (lower.includes('pasien_id') && (lower.includes('format id') || lower.includes('uuid'))) {
    return 'Identitas ID pasien tidak sesuai format. Silakan pilih ulang pasien dari daftar.';
  }
  if (lower.includes('nik') && lower.includes('wajib')) {
    return 'Nomor Induk Kependudukan (NIK) pasien wajib diisi.';
  }
  if (lower.includes('nik') && (lower.includes('16 digit') || lower.includes('regex') || lower.includes('invalid'))) {
    return 'Nomor Induk Kependudukan (NIK) harus 16 digit angka.';
  }
  if (lower.includes('err-rsv-01') || lower.includes('kuota') || lower.includes('penuh')) {
    return 'Kuota antrean untuk sesi jadwal ini sudah penuh. Silakan pilih sesi atau hari lain.';
  }
  if (lower.includes('jadwal tidak tersedia')) {
    return 'Jadwal sesi praktik yang dipilih tidak tersedia atau sudah ditutup. Tolong pilih sesi jadwal lain.';
  }
  if (lower.includes('layanan_id') && (lower.includes('required') || lower.includes('wajib'))) {
    return 'Tolong pilih jenis layanan pemeriksaan terlebih dahulu.';
  }
  if (lower.includes('err-inv-03')) {
    return 'Item obat atau alkes dengan nama dan kategori tersebut sudah terdaftar.';
  }
  if (lower.includes('err-inv-02')) {
    return 'Data item obat atau alkes tidak ditemukan di database.';
  }
  if (lower.includes('err-fin-01')) {
    return 'Jumlah pembayaran melebihi sisa tagihan.';
  }
  if (lower.includes('err-fin-02') || lower.includes('tagihan tidak ditemukan')) {
    return 'Data tagihan pasien tidak ditemukan di database.';
  }
  if (lower.includes('staf_id') && lower.includes('tidak terhubung')) {
    return 'Akun petugas tidak terhubung ke data staf aktif.';
  }
  return msg;
};

/**
 * Mengubah error Axios menjadi pesan yang siap ditampilkan.
 * Untuk HTTP 422, detail validasi per field ikut digabungkan dan diterjemahkan.
 */
export const pesanErrorApi = (
  err: unknown,
  fallback = 'Terjadi kesalahan. Silakan coba lagi.'
): string => {
  if (!axios.isAxiosError(err)) return fallback;
  if (!err.response) return 'Tidak dapat terhubung ke server. Periksa koneksi Anda.';

  const body = err.response.data as ApiErrorBody | undefined;
  const pesan = body?.error?.message;

  if (err.response.status === 422) {
    const detail = detailMessages(body?.error?.details);
    if (detail.length > 0) {
      const joined = detail.join('; ');
      const translated = translateTechnicalError(joined);
      if (translated !== joined) {
        return translated;
      }
      return `${pesan ?? 'Periksa kembali isian Anda'}: ${joined}`;
    }
  }

  if (pesan) {
    return translateTechnicalError(pesan);
  }

  return fallback;
};

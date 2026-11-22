import { apiClient } from './client';
import type { ApiSuccess, LoginResponse } from './types';

export interface ObatItem {
  obat_id: string;
  kode: string;
  nama_generik: string;
  nama_dagang: string | null;
  kategori: string;
  bentuk?: string;
  satuan: string;
  stok_minimum: number;
  stok_total: number;
  aktif?: boolean;
}

export interface HargaObatRow {
  harga_obat_id: string;
  obat_id: string;
  nama_generik?: string;
  harga_jual: number;
  berlaku_dari: string;
  berlaku_sampai: string | null;
}

export interface HargaLayananRow {
  harga_layanan_id: string;
  layanan_id: string;
  nama?: string;
  kelas_id: string | null;
  penjamin_id: string | null;
  harga: number;
  berlaku_dari: string;
  berlaku_sampai: string | null;
}

export interface HargaListResponse {
  layanan: HargaLayananRow[];
  obat: HargaObatRow[];
}

export interface HargaPayload {
  harga: number;
  alasan: string;
  berlaku_dari?: string;
  kelas_id?: string;
  penjamin_id?: string;
}

export interface PesanResponse {
  message: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<ApiSuccess<LoginResponse>>('/auth/login', { username, password }),

  logout: () => apiClient.post<ApiSuccess<PesanResponse>>('/auth/logout', {}),

  refresh: () => apiClient.post<ApiSuccess<{ token: string }>>('/auth/refresh', {}),

  requestReset: (email: string) =>
    apiClient.post<ApiSuccess<PesanResponse>>('/auth/reset/request', { email }),

  verifyReset: (email: string, otp: string, passwordBaru: string) =>
    apiClient.post<ApiSuccess<PesanResponse>>('/auth/reset/verify', {
      email,
      otp,
      password_baru: passwordBaru,
    }),
};

export const dashboardApi = {
  listObat: (body: { q?: string; limit?: number } = { limit: 200 }) =>
    apiClient.post<ApiSuccess<ObatItem[]>>('/obat/list', body),

  listInventaris: (body: { q?: string; limit?: number } = { limit: 200 }) =>
    apiClient.post<ApiSuccess<ObatItem[]>>('/inventaris/list', body),

  listHarga: () => apiClient.post<ApiSuccess<HargaListResponse>>('/harga/list', {}),

  setHargaObat: (obatId: string, body: HargaPayload) =>
    apiClient.put<ApiSuccess<HargaObatRow>>(`/harga/OBAT/${obatId}`, body),

  setHargaLayanan: (layananId: string, body: HargaPayload) =>
    apiClient.put<ApiSuccess<HargaLayananRow>>(`/harga/LAYANAN/${layananId}`, body),

  listRekapKeuangan: (body: { dari?: string | null; sampai?: string | null } = {}) =>
    apiClient.post<ApiSuccess<Record<string, unknown>[]>>('/keuangan/rekap/list', body),

  listAudit: (body: { dari?: string; sampai?: string; limit?: number } = {}) =>
    apiClient.post<ApiSuccess<Record<string, unknown>[]>>('/audit-logs/list', body),

  listReservasi: (body: Record<string, unknown> = {}) =>
    apiClient.post<ApiSuccess<Record<string, unknown>[]>>('/reservasi/list', body),

  listNotifikasi: (body: { limit?: number } = {}) =>
    apiClient.post<ApiSuccess<Record<string, unknown>[]>>('/notifikasi/log/list', body),
};

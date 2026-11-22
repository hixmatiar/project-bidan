import { apiClient } from './client';
import type { ApiSuccess, LoginResponse } from './types';

export interface PesanResponse {
  message: string;
}

export interface RuanganItem {
  ruangan_id: string;
  unit_id: string;
  kode: string;
  nama: string;
  kelas?: string | null;
  kapasitas?: number | null;
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
  listRuangan: () => apiClient.post<ApiSuccess<RuanganItem[]>>('/ruangan/list', {}),
};

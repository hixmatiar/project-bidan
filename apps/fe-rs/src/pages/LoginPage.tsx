import React, { useState } from 'react';
import { apiClient, session } from '../api/client';
import { authApi } from '../api/endpoints';
import { pesanErrorApi } from '../api/errors';
import type { ApiSuccess, LoginResponse } from '../api/types';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState<'none' | 'request' | 'verify'>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const bukaLupaSandi = () => {
    setResetStep('request');
    setError(null);
    setNotice(null);
    setResetEmail(username.includes('@') ? username : '');
  };

  const kembaliKeLogin = () => {
    setResetStep('none');
    setError(null);
    setNotice(null);
    setOtp('');
    setNewPassword('');
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const response = await authApi.requestReset(resetEmail);
      setNotice(response.data.data.message);
      setResetStep('verify');
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal mengirim kode OTP. Periksa kembali email Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const response = await authApi.verifyReset(resetEmail, otp, newPassword);
      setNotice(response.data.data.message);
      setResetStep('none');
      setOtp('');
      setNewPassword('');
      setPassword('');
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal mengubah kata sandi. Periksa kembali kode OTP Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post<ApiSuccess<LoginResponse>>('/auth/login', {
        username,
        password,
      });

      if (response.data.success) {
        session.simpanToken(response.data.data.token);
        localStorage.setItem('rs_user_role', response.data.data.peran);
        onLoginSuccess();
      }
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal masuk. Periksa kembali kredensial Anda.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">SIMRS</h1>
        <p className="login-subtitle">Sistem Informasi Rumah Sakit</p>

        {error && <div className="alert alert-danger">{error}</div>}
        {notice && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#15803d',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {notice}
          </div>
        )}

        {resetStep === 'none' && (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Masukkan username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Kata Sandi</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Masukkan kata sandi"
            />
            <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={bukaLupaSandi}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary, #2563eb)', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Lupa kata sandi?
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        )}

        {resetStep === 'request' && (
          <form onSubmit={handleResetRequest}>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.6 }}>
              Masukkan email terdaftar. Kami akan mengirim kode OTP 6 digit untuk mengatur ulang kata sandi.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                className="form-input"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="nama@email.com"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
            </button>
            <button
              type="button"
              onClick={kembaliKeLogin}
              style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--color-primary, #2563eb)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Kembali ke halaman masuk
            </button>
          </form>
        )}

        {resetStep === 'verify' && (
          <form onSubmit={handleResetVerify}>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.6 }}>
              Kode OTP dikirim ke <strong>{resetEmail}</strong>. Masukkan kode tersebut beserta kata sandi baru Anda.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="otp">Kode OTP (6 digit)</label>
              <input
                id="otp"
                type="text"
                className="form-input"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="123456"
                style={{ textAlign: 'center', letterSpacing: '0.35rem', fontSize: '1.1rem' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">Kata Sandi Baru (minimal 8 karakter)</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Masukkan kata sandi baru"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
            </button>
            <button
              type="button"
              onClick={kembaliKeLogin}
              style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--color-primary, #2563eb)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Kembali ke halaman masuk
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

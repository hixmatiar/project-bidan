import React, { useState } from 'react';
import { apiClient, session } from '../api/client';
import { authApi } from '../api/endpoints';
import { pesanErrorApi } from '../api/errors';
import type { ApiSuccess, LoginResponse } from '../api/types';

interface LoginPageProps {
  onLoginSuccess: (role: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN') => void;
  onBackToHome: () => void;
  initialRole?: 'superadmin' | 'admin' | 'bidan' | 'pasien';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToHome }) => {
  // Mode: login, register, request_otp, verify_otp
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'request_otp' | 'verify_otp'>('login');
  
  // Login State
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  
  // Register State
  const [regForm, setRegForm] = useState({
    nama: '',
    username: '',
    nik: '',
    email: '',
    password: '',
    no_hp: '',
    jenis_kelamin: 'PEREMPUAN'
  });

  // Reset OTP State
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1 Pintu: Login menggunakan Username, NIK terdaftar, atau Email
      const response = await apiClient.post<ApiSuccess<LoginResponse>>('/auth/login', {
        username: identifier.trim(),
        password: secret,
      });

      if (response.data && response.data.success) {
        const resData = response.data.data as any;
        const { token, peran } = resData;
        const displayName = resData.nama || identifier.trim();
        session.simpanToken(token);
        
        let roleType: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN' = 'ADMIN_LOKAL';
        if (peran === 'SUPERADMIN') roleType = 'SUPERADMIN';
        else if (peran === 'DOKTER') roleType = 'DOKTER';
        else if (peran === 'PASIEN') roleType = 'PASIEN';
        else roleType = 'ADMIN_LOKAL';

        localStorage.setItem('bidan_user_role', roleType);
        localStorage.setItem('bidan_user_identifier', identifier.trim());
        localStorage.setItem('bidan_user_nama', displayName);
        localStorage.setItem('bidan_pasien_nama', displayName);
        if (resData.pasien_id) localStorage.setItem('bidan_user_pasien_id', resData.pasien_id);
        if (resData.nik) localStorage.setItem('bidan_user_nik', resData.nik);
        setLoading(false);
        onLoginSuccess(roleType);
        return;
      }
    } catch {
      // Point 7 & Point 3: Pesan kesalahan ramah dan standar
      setError('Kata sandi atau username/NIK salah');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (regForm.nik.length !== 16) {
      setError('NIK harus terdiri dari 16 digit angka');
      setLoading(false);
      return;
    }
    if (regForm.password.length < 8) {
      setError('Kata sandi minimal 8 karakter');
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.post<ApiSuccess<{ token: string; peran: string }>>('/auth/register-pasien', {
        nama: regForm.nama.trim(),
        username: regForm.username.trim(),
        nik: regForm.nik.trim(),
        email: regForm.email.trim(),
        password: regForm.password,
        no_hp: regForm.no_hp.trim(),
        jenis_kelamin: regForm.jenis_kelamin
      });

      if (res.data && res.data.success) {
        // Simpan info identitas pasien, namun JANGAN langsung login/masuk (Poin 1)
        localStorage.setItem('bidan_user_identifier', regForm.username.trim());
        localStorage.setItem('bidan_user_nama', regForm.nama.trim());
        localStorage.setItem('bidan_pasien_nama', regForm.nama.trim());
        localStorage.setItem('bidan_user_nik', regForm.nik.trim());
        localStorage.setItem('bidan_user_email', regForm.email.trim());
        localStorage.setItem('bidan_user_no_hp', regForm.no_hp.trim());

        // Arahkan ke laman login biasa dengan notifikasi sukses (Poin 1)
        setAuthMode('login');
        setIdentifier(regForm.username.trim());
        setSecret('');
        setNotice(`Akun ${regForm.nama.trim()} berhasil dibuat! Silakan masuk dengan kata sandi Anda.`);
        setRegForm({
          nama: '',
          username: '',
          nik: '',
          email: '',
          password: '',
          no_hp: '',
          jenis_kelamin: 'PEREMPUAN'
        });
      }
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal membuat akun pasien. Pastikan username dan NIK belum terdaftar.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authApi.requestReset(resetEmail.trim());
      setNotice(response.data.data.message || 'Kode OTP telah dikirim ke email Anda.');
      setAuthMode('verify_otp');
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal mengirim kode OTP. Periksa kembali email Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authApi.verifyReset(resetEmail.trim(), otp.trim(), newPassword);
      setNotice(response.data.data.message || 'Kata sandi berhasil diperbarui. Silakan login kembali.');
      setAuthMode('login');
      setIdentifier(resetEmail.trim());
      setSecret('');
      setOtp('');
      setNewPassword('');
    } catch (err: unknown) {
      setError(pesanErrorApi(err, 'Gagal mengubah kata sandi. Periksa kembali kode OTP Anda.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 10%, #f4e8ff 0%, #fbf9fd 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: '#ffffff', borderRadius: '24px', border: '1px solid var(--border-medium)', boxShadow: '0 25px 50px -12px rgba(78, 32, 112, 0.15)', padding: '2.25rem 2rem' }}>
        
        {/* Header Portal */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src="/logo-bidan.png"
            alt="Logo Bidan Ria"
            style={{ width: '70px', height: '70px', objectFit: 'contain', margin: '0 auto 0.75rem auto', display: 'block' }}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes('public/logo-bidan.png')) {
                target.src = './public/logo-bidan.png';
              }
            }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-dark)', lineHeight: 1.2 }}>
            Portal Layanan Kesehatan
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Praktik Mandiri Bidan Ria Indrasti J., S.Keb. — Kota Jambi
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Notice Alert */}
        {notice && (
          <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>{notice}</span>
          </div>
        )}

        {/* 1 PINTU LOGIN FORM (Point 15 & Point 7) */}
        {authMode === 'login' && (
          <form onSubmit={handleFormSubmit}>
            <div style={{ marginBottom: '1.15rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                Identitas Akun
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username / NIK terdaftar / Email"
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  color: 'var(--color-slate-800)'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Masukkan kata sandi"
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9375rem',
                  outline: 'none'
                }}
              />
              <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('request_otp');
                    setError(null);
                    setNotice(null);
                    setResetEmail(identifier.includes('@') ? identifier : '');
                  }}
                  style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Lupa kata sandi?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9375rem', fontWeight: 700 }}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>

            <div style={{ marginTop: '1.25rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', margin: '0 0 0.5rem 0' }}>
                Pasien baru dan ingin reservasi online?
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                  setNotice(null);
                }}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                + Daftar Akun Pasien Baru
              </button>
            </div>
          </form>
        )}

        {/* REGISTRASI AKUN PASIEN BARU (Point 2, 3, 6) */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: '0 0 0.25rem 0' }}>
                Registrasi Akun Pasien Baru
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: 0 }}>
                Akun digunakan untuk login panel pasien, reservasi online, dan memantau antrean.
              </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Nama Lengkap Pasien *</label>
              <input
                type="text"
                required
                value={regForm.nama}
                onChange={(e) => setRegForm({ ...regForm, nama: e.target.value })}
                placeholder="cth: Ratna Dewi"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Username *</label>
                <input
                  type="text"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="cth: ratnadewi"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>NIK (16 Digit) *</label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={regForm.nik}
                  onChange={(e) => setRegForm({ ...regForm, nik: e.target.value.replace(/\D/g, '') })}
                  placeholder="1571xxxxxxxxxxxx"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Email Aktif (Untuk Notifikasi &amp; Reset OTP) *</label>
              <input
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="pasien@gmail.com"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Kata Sandi (Min 8 Karakter) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="Minimal 8 karakter"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>No WhatsApp / HP *</label>
                <input
                  type="tel"
                  required
                  value={regForm.no_hp}
                  onChange={(e) => setRegForm({ ...regForm, no_hp: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9375rem', fontWeight: 700 }}
            >
              {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun'}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setNotice(null);
              }}
              style={{ width: '100%', marginTop: '0.85rem', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              &larr; Sudah punya akun? Masuk di sini
            </button>
          </form>
        )}

        {/* LUPA KATA SANDI — KIRIM KODE OTP */}
        {authMode === 'request_otp' && (
          <form onSubmit={handleResetRequest}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', marginBottom: '1.15rem', lineHeight: 1.6 }}>
              Masukkan email akun Anda. Kami akan mengirimkan kode verifikasi OTP 6 digit untuk memperbarui kata sandi di database.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                Email Terdaftar
              </label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="nama@email.com"
                style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-shimmer"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9375rem', fontWeight: 700 }}
            >
              {loading ? 'Mengirim kode OTP...' : 'Kirim Kode OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setNotice(null);
              }}
              style={{ width: '100%', marginTop: '0.85rem', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Kembali ke Halaman Masuk
            </button>
          </form>
        )}

        {/* VERIFIKASI OTP & KATA SANDI BARU */}
        {authMode === 'verify_otp' && (
          <form onSubmit={handleResetVerify}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', marginBottom: '1.15rem', lineHeight: 1.6 }}>
              Kode OTP telah dikirim ke <strong>{resetEmail}</strong>. Masukkan kode tersebut beserta kata sandi baru Anda.
            </p>
            <div style={{ marginBottom: '1.15rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                Kode OTP (6 digit)
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '1.1rem', letterSpacing: '0.35rem', textAlign: 'center', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                Kata Sandi Baru (minimal 8 karakter)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru"
                style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-shimmer"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9375rem', fontWeight: 700 }}
            >
              {loading ? 'Menyimpan kata sandi...' : 'Simpan Kata Sandi Baru'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setNotice(null);
              }}
              style={{ width: '100%', marginTop: '0.85rem', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Kembali ke Halaman Masuk
            </button>
          </form>
        )}

        {/* Back to Home Link */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', paddingTop: '1.15rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            onClick={onBackToHome}
            style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            <span>Kembali ke Halaman Utama</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;

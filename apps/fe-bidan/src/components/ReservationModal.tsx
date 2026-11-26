import React, { useState, useEffect } from 'react';
import { apiClient, session } from '../api/client';
import { KLINIK_INFO } from '../constants/klinik';
import { LayananItem, SesiPraktikItem } from '../api/types';
import { pesanErrorApi } from '../api/errors';

export const formatJam = (val: any): string => {
  if (!val) return '08:00';
  const str = String(val);
  const match = str.match(/T(\d{2}:\d{2})/);
  if (match && match[1]) return match[1];
  const matchTime = str.match(/^(\d{2}:\d{2})/);
  if (matchTime && matchTime[1]) return matchTime[1];
  return str.slice(0, 5);
};

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLayanan?: LayananItem | null;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  selectedLayanan
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [sesiList, setSesiList] = useState<SesiPraktikItem[]>([]);

  const isAlreadyLoggedIn = Boolean(session.bacaToken() && localStorage.getItem('bidan_user_role') === 'PASIEN');

  const [successTicket, setSuccessTicket] = useState<{
    kode: string;
    nomorAntrean: string;
    estimasiJam: string;
    layananNama: string;
    sesiNama: string;
    tanggal: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    nama: '',
    username: '',
    nik: '',
    password: '',
    no_hp: '',
    email: '',
    jenis_kelamin: 'P' as 'P' | 'L',
    tanggal: new Date().toISOString().split('T')[0] || '',
    sesi_id: '',
    layanan_id: selectedLayanan ? selectedLayanan.layanan_id : '',
    keluhan: ''
  });

  useEffect(() => {
    if (!isOpen) return;

    if (isAlreadyLoggedIn) {
      const savedUser = localStorage.getItem('bidan_user_identifier') || '';
      const savedNama = localStorage.getItem('bidan_pasien_nama') || localStorage.getItem('bidan_user_nama') || '';
      const savedNik = localStorage.getItem('bidan_user_nik') || '';
      const savedEmail = localStorage.getItem('bidan_user_email') || '';
      const savedNoHp = localStorage.getItem('bidan_user_no_hp') || '';
      setFormData(prev => ({
        ...prev,
        username: savedUser || prev.username,
        nama: savedNama || prev.nama,
        nik: savedNik || prev.nik,
        email: savedEmail || prev.email,
        no_hp: savedNoHp || prev.no_hp
      }));
    }

    // Ambil daftar layanan dari database
    apiClient.post<{ success: boolean; data: any[] }>('/public/layanan/list', {})
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const list: LayananItem[] = res.data.data.map((l: any) => {
            const rawNama = l.nama || 'Layanan Medis';
            const cleanNama = rawNama.replace(/dokter umum/gi, 'Pemeriksaan Umum');
            return {
              layanan_id: l.layanan_id || l.kode || 'LAY-0',
              nama: cleanNama,
              kategori: l.kategori || 'Kebidanan',
              deskripsi: l.deskripsi || '',
              durasi_menit: l.durasi_menit || 30,
              highlight: l.highlight || 'Pelayanan Standar Medis',
              icon: 'anc',
              cakupan: []
            };
          });
          setLayananList(list);
          if (!formData.layanan_id && list.length > 0) {
            setFormData(prev => ({ ...prev, layanan_id: list[0]?.layanan_id || '' }));
          }
        }
      })
      .catch(() => {});

    // Ambil daftar sesi praktik dari database
    apiClient.post<{ success: boolean; data: any[] }>('/public/sesi/list', {})
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const list: SesiPraktikItem[] = res.data.data.map((s: any, idx: number) => {
            const kuotaMaks = Number(s.kuota_maks || 15);
            const sisa = typeof s.sisa_kuota === 'number' ? s.sisa_kuota : kuotaMaks;
            const jMulai = formatJam(s.jam_mulai || (idx === 0 ? '08:00' : '16:00'));
            const jSelesai = formatJam(s.jam_selesai || (idx === 0 ? '12:00' : '20:00'));
            const tglLabel = s.tanggal ? `${String(s.tanggal).split('T')[0]} ` : '';
            return {
              sesi_id: s.jadwal_id || s.sesi_id || `SESI-${idx}`,
              nama: `Sesi ${tglLabel}(${jMulai} - ${jSelesai} WIB)`,
              jam_mulai: jMulai,
              jam_selesai: jSelesai,
              kuota_maks: kuotaMaks,
              durasi_per_pasien: s.durasi_per_pasien || 20,
              terisi: kuotaMaks - sisa,
              sisa_kuota: sisa,
              status: sisa <= 0 ? 'PENUH' : 'BUKA',
              keterangan: s.keterangan || ''
            };
          });
          setSesiList(list);
          if (!formData.sesi_id && list.length > 0) {
            setFormData(prev => ({ ...prev, sesi_id: list[0]?.sesi_id || '' }));
          }
        }
      })
      .catch(() => {});
  }, [isOpen, isAlreadyLoggedIn]);

  useEffect(() => {
    if (selectedLayanan) {
      setFormData(prev => ({ ...prev, layanan_id: selectedLayanan.layanan_id }));
    }
  }, [selectedLayanan]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!formData.sesi_id || formData.sesi_id.trim() === '') {
      setErrorMessage('Tolong pilih jadwal terlebih dahulu');
      setIsSubmitting(false);
      return;
    }
    if (!formData.layanan_id || formData.layanan_id.trim() === '') {
      setErrorMessage('Tolong pilih layanan pemeriksaan terlebih dahulu');
      setIsSubmitting(false);
      return;
    }
    if (!formData.nik || formData.nik.trim().length !== 16) {
      setErrorMessage('NIK harus terdiri dari 16 digit angka');
      setIsSubmitting(false);
      return;
    }
    if (!isAlreadyLoggedIn && (!formData.password || formData.password.length < 8)) {
      setErrorMessage('Kata sandi akun minimal 8 karakter');
      setIsSubmitting(false);
      return;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setErrorMessage('Email aktif wajib diisi untuk pengiriman notifikasi tiket');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Cek pasien terdaftar
      let existingPasienId: string | undefined = undefined;
      try {
        const checkRes = await apiClient.post<{ success: boolean; data?: { terdaftar: boolean; pasien_id?: string } }>('/public/pasien/cek', {
          nik: formData.nik.trim()
        });
        if (checkRes.data?.data?.terdaftar && checkRes.data.data.pasien_id) {
          existingPasienId = checkRes.data.data.pasien_id;
        }
      } catch {
        // Fallback
      }

      // 2. Direct call ke database endpoint: POST /api/v1/public/reservasi
      // Menyimpan data pasien, akun pengguna (PASIEN), dan tiket reservasi ke SQL Server
      const res = await apiClient.post('/public/reservasi', {
        pasien_id: existingPasienId,
        jadwal_id: formData.sesi_id,
        sesi_id: formData.sesi_id,
        layanan_id: formData.layanan_id,
        metode_daftar: 'ONLINE',
        nama: formData.nama.trim(),
        username: (formData.username || formData.nama).trim(),
        nik: formData.nik.trim(),
        password: formData.password || undefined,
        no_hp: formData.no_hp.trim(),
        email: formData.email.trim(),
        jenis_kelamin: formData.jenis_kelamin,
        tanggal: formData.tanggal,
        keluhan: formData.keluhan.trim()
      });

      const d = res.data?.data || {};
      const targetLayanan = layananList.find(l => l.layanan_id === formData.layanan_id);
      const targetSesi = sesiList.find(s => s.sesi_id === formData.sesi_id);

      const sesiTimeClean = targetSesi
        ? `${targetSesi.jam_mulai} - ${targetSesi.jam_selesai} WIB`
        : '08:00 - 12:00 WIB';

      const newTicketObj = {
        kode: d.kode_reservasi || `RES-${Date.now().toString().slice(-6)}`,
        nomorAntrean: d.nomor_antrean ? `A-${String(d.nomor_antrean).padStart(3, '0')}` : `A-${Math.floor(Math.random() * 20 + 1).toString().padStart(3, '0')}`,
        estimasiJam: sesiTimeClean,
        layananNama: targetLayanan?.nama || 'Pemeriksaan Medis',
        sesiNama: targetSesi?.nama || 'Sesi Terjadwal',
        tanggal: formData.tanggal,
        nama: formData.nama.trim(),
        nik: formData.nik.trim()
      };
      setSuccessTicket(newTicketObj);
      localStorage.setItem('bidan_last_ticket', JSON.stringify(newTicketObj));
      localStorage.setItem('bidan_user_nik', formData.nik.trim());
      localStorage.setItem('bidan_pasien_nama', formData.nama.trim());
      setStep(3);
    } catch (err: unknown) {
      const msg = pesanErrorApi(err, 'Gagal memproses reservasi ke database. Pastikan data lengkap.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setSuccessTicket(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-medium)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modal Header */}
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf8fc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                Reservasi Layanan &amp; Antrean Online
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', margin: '0.1rem 0 0 0' }}>
                Praktik Mandiri Bidan Ria Indrasti — Simpang Rimbo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-slate-500)', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem', overflowY: 'auto' }}>
          {errorMessage && (
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 1 && (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '1.25rem' }}>
                Langkah 1: Pilih Layanan &amp; Sesi Praktik
              </h4>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.5rem' }}>
                  Jenis Layanan Pemeriksaan *
                </label>
                <select
                  value={formData.layanan_id}
                  onChange={(e) => setFormData({ ...formData, layanan_id: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                >
                  <option value="">-- Pilih Layanan Kebidanan --</option>
                  {layananList.map((l) => (
                    <option key={l.layanan_id} value={l.layanan_id}>
                      {l.nama} ({l.kategori})
                    </option>
                  ))}
                </select>
              </div>

              <div className="dash-grid-2" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.5rem' }}>
                    Tanggal Rencana Kunjungan
                  </label>
                  <input
                    type="date"
                    value={formData.tanggal}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.5rem' }}>
                    Pilihan Sesi Praktik *
                  </label>
                  <select
                    value={formData.sesi_id}
                    onChange={(e) => setFormData({ ...formData, sesi_id: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                  >
                    <option value="">-- Tolong Pilih Sesi Jadwal --</option>
                    {sesiList.map((s) => (
                      <option key={s.sesi_id} value={s.sesi_id} disabled={s.sisa_kuota <= 0}>
                        {s.nama} ({s.jam_mulai} - {s.jam_selesai} WIB) - Sisa {s.sisa_kuota} Kuota {s.sisa_kuota <= 0 ? '(Penuh)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.layanan_id) {
                      setErrorMessage('Tolong pilih layanan pemeriksaan terlebih dahulu.');
                      return;
                    }
                    if (!formData.sesi_id) {
                      setErrorMessage('Tolong pilih jadwal terlebih dahulu');
                      return;
                    }
                    setErrorMessage(null);
                    setStep(2);
                  }}
                  className="btn btn-primary btn-shimmer"
                >
                  <span>Lanjutkan ke Akun &amp; Data Pasien</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
                Langkah 2: Data Diri Pasien
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.25rem' }}>
                {isAlreadyLoggedIn ? 'Lengkapi keluhan kunjungan Anda di bawah ini.' : 'Buat akun pasien untuk memantau antrean dan jadwal kontrol selanjutnya.'}
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                  Nama Lengkap Pasien *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ratna Dewi"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                />
              </div>

              <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                    Username Panel Pasien *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isAlreadyLoggedIn}
                    placeholder="Contoh: ratnadewi"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none', background: isAlreadyLoggedIn ? '#f8fafc' : '#ffffff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                    Nomor Induk Kependudukan (NIK) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    placeholder="16 digit NIK terdaftar"
                    value={formData.nik}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {!isAlreadyLoggedIn && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                    Kata Sandi Akun Pasien * (Minimal 8 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Masukkan kata sandi untuk login"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                  />
                </div>
              )}

              <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                    Email Aktif * (Notifikasi &amp; Reset OTP)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                    Nomor WhatsApp / HP Aktif *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08123456789"
                    value={formData.no_hp}
                    onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Pilihan Jenis Kelamin (P / L) */}
              <div style={{ marginBottom: '1rem', background: '#faf5fe', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #efe8f6' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                  Jenis Kelamin Pasien *
                </label>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                    <input
                      type="radio"
                      name="modal_jenis_kelamin"
                      value="P"
                      checked={formData.jenis_kelamin === 'P'}
                      onChange={() => setFormData({ ...formData, jenis_kelamin: 'P' })}
                    />
                    <span>Perempuan (Ibu Hamil / Bersalin / Anak P)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                    <input
                      type="radio"
                      name="modal_jenis_kelamin"
                      value="L"
                      checked={formData.jenis_kelamin === 'L'}
                      onChange={() => setFormData({ ...formData, jenis_kelamin: 'L' })}
                    />
                    <span>Laki-laki (Bayi / Pasien Anak L)</span>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.4rem' }}>
                  Keluhan / Alasan Kunjungan
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pemeriksaan kehamilan rutin, keluhan mual, kontrol pasca salin..."
                  value={formData.keluhan}
                  onChange={(e) => setFormData({ ...formData, keluhan: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9375rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  Kembali
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? 'Memproses...' : 'Konfirmasi Reservasi'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && successTicket && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                Reservasi Berhasil Dikonfirmasi
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
                Simpan atau tunjukkan nomor antrean ini kepada petugas loket saat tiba di klinik.
              </p>

              {/* Digital Ticket Card */}
              <div style={{ margin: '1.75rem auto', padding: '1.5rem', background: '#faf5fe', border: '2px dashed var(--border-medium)', borderRadius: '16px', maxWidth: '420px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nomor Antrean Anda
                </span>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--color-primary-dark)', margin: '0.5rem 0' }}>
                  {successTicket.nomorAntrean}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                  {successTicket.layananNama}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: '0.25rem', fontWeight: 600 }}>
                  {successTicket.sesiNama} ({successTicket.estimasiJam})
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>
                  Tanggal Kunjungan: {successTicket.tanggal}
                </div>
              </div>

              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.5rem' }}>
                Alamat Klinik: {KLINIK_INFO.alamat}
              </p>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="btn btn-primary btn-shimmer"
                style={{ width: '100%' }}
              >
                Selesai &amp; Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationModal;

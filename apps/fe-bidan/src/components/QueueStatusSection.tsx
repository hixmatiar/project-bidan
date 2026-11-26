import React, { useState } from 'react';
import { apiClient } from '../api/client';
import type { AntreanItem } from '../api/types';

interface QueueStatusSectionProps {
  isLoading?: boolean;
}

export const QueueStatusSection: React.FC<QueueStatusSectionProps> = ({ isLoading = false }) => {
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [antreanList] = useState<AntreanItem[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchKey.trim();
    if (!query) return;

    setSearching(true);
    setSearchResult(null);

    try {
      // Cek langsung ke database backend /public/pasien/cek
      const payload = /^\d{16}$/.test(query) ? { nik: query } : { no_rm: query };
      const res = await apiClient.post<{ success: boolean; data: any }>('/public/pasien/cek', payload);
      
      if (res.data?.success && res.data.data?.terdaftar) {
        setSearchResult(`Pasien terdaftar: ${res.data.data.nama || 'Pasien'}. Silakan konfirmasi kedatangan di loket.`);
      } else {
        setSearchResult(`Data "${query}" belum terdaftar.`);
      }
    } catch {
      setSearchResult(`Tidak ada antrean aktif untuk "${query}".`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <section id="antrean" style={{ padding: '5rem 0', background: '#ffffff', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container">
        <div className="section-header">
          <div className="section-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Transparansi Sesi</span>
          </div>
          <h2 className="section-title">Status Antrean Ruang Tunggu</h2>
          <p className="section-subtitle">
            Pantau pergerakan antrean pasien secara transparan untuk meminimalkan waktu tunggu di klinik.
          </p>
        </div>

        {isLoading ? (
          <div className="queue-box">
            <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }}></div>
          </div>
        ) : (
          <div className="queue-box">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
              {/* Active Serving Display */}
              <div style={{ background: '#faf5fe', padding: '2rem', borderRadius: '16px', border: '1px solid #efe8f6', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status Sesi Saat Ini
                </span>
                <div style={{ fontSize: '3.25rem', fontWeight: 900, color: 'var(--color-primary-dark)', lineHeight: 1.1, margin: '0.75rem 0' }}>
                  SIAP
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                  Layanan Konsultasi &amp; Pemeriksaan
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: '0.35rem' }}>
                  Loket Bidan Ria Indrasti — Simpang Rimbo
                </div>
              </div>

              {/* Next in Queue List */}
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Antrean Menunggu</span>
                </h4>

                {antreanList.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-medium)', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>
                    Belum ada antrean pasien yang sedang menunggu saat ini. Pasien dipersilakan mendaftar secara online atau langsung di loket.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {antreanList.map((a) => (
                      <div key={a.antrean_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                            {a.nomor_antrean}
                          </span>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>{a.nama_samaran}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{a.nama_layanan}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-slate-600)', background: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          {a.status || 'MENUNGGU'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Check Patient's Ticket Form */}
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px', margin: '0 auto', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Masukkan Nomor Rekam Medis atau NIK (16 digit)..."
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    padding: '0.75rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.9375rem',
                    outline: 'none'
                  }}
                />
                <button type="submit" disabled={searching} className="btn btn-primary btn-shimmer" style={{ padding: '0.75rem 1.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span>{searching ? 'Mengecek...' : 'Cek Status Pasien'}</span>
                </button>
              </form>

              {searchResult && (
                <div style={{ marginTop: '1.25rem', padding: '0.9rem 1.25rem', background: '#f5f3ff', color: 'var(--color-primary-dark)', borderRadius: '10px', fontSize: '0.875rem', textAlign: 'center', border: '1px solid #ddd6fe', maxWidth: '600px', margin: '1.25rem auto 0 auto' }}>
                  {searchResult}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

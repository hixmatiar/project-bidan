import React from 'react';
import { KLINIK_INFO } from '../constants/klinik';

export const AboutSection: React.FC = () => {
  return (
    <section id="profil" style={{ padding: '5.5rem 0', background: 'var(--bg-page)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3.5rem', alignItems: 'center' }}>
          {/* Left Column: Visual Profile Card */}
          <div style={{ textAlign: 'center' }}>
            <div className="card-hover" style={{ padding: '2.5rem', background: '#ffffff', borderRadius: '24px', border: '1px solid var(--border-medium)', maxWidth: '380px', margin: '0 auto' }}>
              <div style={{ width: '150px', height: '150px', margin: '0 auto 1.5rem auto', borderRadius: '50%', background: '#faf5fe', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #efe8f6' }}>
                <img
                  src="/logo-bidan.png"
                  alt="Bdn. Ria Indrasti"
                  style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('public/logo-bidan.png')) {
                      target.src = './public/logo-bidan.png';
                    }
                  }}
                />
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                {KLINIK_INFO.bidan}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
                Bidan Praktisi Mandiri Berizin Resmi
              </p>

              <div style={{ margin: '1.25rem 0', padding: '0.75rem', background: '#faf5fe', borderRadius: '10px', fontSize: '0.8125rem', color: 'var(--color-slate-700)', border: '1px solid #efe8f6' }}>
                <strong>Nomor Registrasi Praktik:</strong><br/>
                {KLINIK_INFO.sipb}
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: '1.6' }}>
                Berdedikasi dalam memberikan asuhan kebidanan yang aman, penuh empati, dan berkesinambungan bagi masyarakat Kota Jambi.
              </p>
            </div>
          </div>

          {/* Right Column: Philosophy & Values */}
          <div>
            <div className="section-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Tentang Praktik Mandiri</span>
            </div>

            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-slate-900)', lineHeight: 1.25, marginBottom: '1.25rem' }}>
              Komitmen Asuhan Kebidanan yang Hangat & Terpercaya
            </h2>

            <p style={{ fontSize: '1rem', color: 'var(--color-slate-600)', lineHeight: '1.7', marginBottom: '2rem' }}>
              Praktik Mandiri Bidan Ria Indrasti berfokus pada asuhan kebidanan yang berpusat pada ibu dan keluarga (*family-centered maternity care*). Setiap ibu hamil dan bayi baru lahir berhak mendapatkan pelayanan medis yang bermartabat, higienis, dan terencana dengan baik.
            </p>

            {/* 3 Pillars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>Siaga Persalinan 24 Jam Penuh</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginTop: '0.2rem' }}>
                    Kesiapan kamar bersalin dan pertolongan persalinan alami kapan pun proses persalinan dimulai.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>Standar Higienitas & Kesterilan Tinggi</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginTop: '0.2rem' }}>
                    Alat medis yang disterilkan secara berkala dan tata ruang asuhan yang mengutamakan kenyamanan dan pencegahan infeksi.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>Lokasi Mudah Dijangkau di Kota Jambi</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginTop: '0.2rem', lineHeight: '1.5' }}>
                    {KLINIK_INFO.alamat}
                  </p>
                  <div style={{ marginTop: '0.5rem' }}>
                    <a
                      href={KLINIK_INFO.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--color-primary-dark)',
                        textDecoration: 'none'
                      }}
                    >
                      Lihat Rute di Google Maps &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { KLINIK_INFO } from '../constants/klinik';

export const Footer: React.FC = () => {
  return (
    <footer id="kontak" className="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Clinic Brand & Legal */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <img
                src="/logo-bidan.png"
                alt="Logo Praktik Bidan Ria Indrasti"
                style={{ height: '48px', width: 'auto', background: '#ffffff', padding: '4px', borderRadius: '50%' }}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('public/logo-bidan.png')) {
                    target.src = './public/logo-bidan.png';
                  }
                }}
              />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Praktik Mandiri Bidan
                </div>
                <div style={{ fontSize: '0.85rem', color: '#fcd34d', fontWeight: 700 }}>
                  Ria Indrasti J. S.keb
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', lineHeight: '1.65', color: '#cbd5e1', marginBottom: '1.5rem', maxWidth: '340px' }}>
              Pusat asuhan kebidanan mandiri berstandar higienis tinggi dengan pelayanan persalinan normal siaga 24 jam dan pemeriksaan kesehatan ibu-anak terjadwal.
            </p>

            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              <div><strong>Nomor Izin Praktik:</strong></div>
              <div style={{ color: '#e2e8f0' }}>{KLINIK_INFO.sipb}</div>
            </div>
          </div>

          {/* Contact & Hours */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem' }}>
              Kontak & Jam Pelayanan
            </h4>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>Hotline / WhatsApp (24 Jam):</div>
                  <a href={`tel:${KLINIK_INFO.telepon}`} style={{ color: '#fcd34d' }}>{KLINIK_INFO.telepon}</a>
                </div>
              </li>

              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>Persalinan Normal & Darurat:</div>
                  <div>Siaga 24 Jam Non-Stop</div>
                </div>
              </li>

              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>Sesi Konsultasi & ANC:</div>
                  <div>Sesi: 08:00 - 12:00 | 16:00 - 20:00 WIB</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Address & Academic Attribution */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem' }}>
              Alamat Praktik
            </h4>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <div style={{ color: '#ffffff', fontWeight: 600 }}>Lokasi Praktik:</div>
                <div style={{ color: '#cbd5e1', lineHeight: '1.5' }}>{KLINIK_INFO.alamat}</div>
                <div style={{ marginTop: '0.5rem' }}>
                  <a
                    href={KLINIK_INFO.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(252, 211, 77, 0.15)',
                      color: '#fcd34d',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      border: '1px solid rgba(252, 211, 77, 0.3)'
                    }}
                  >
                    📍 Buka di Google Maps ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Embedded Google Maps Preview */}
            <div style={{ width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', marginTop: '0.75rem' }}>
              <iframe
                title="Peta Lokasi Praktik Mandiri Bidan Ria Indrasti"
                src={KLINIK_INFO.embedMapsUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} Praktik Mandiri Bidan Ria Indrasti J. S.keb. Hak Cipta Dilindungi.
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span>Kepatuhan UU PDP No. 27/2022 (Perlindungan Data Pribadi)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

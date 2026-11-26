import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { LayananItem } from '../api/types';

interface ServicesSectionProps {
  onSelectService: (layanan: LayananItem) => void;
  isLoading?: boolean;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectService, isLoading: propLoading = false }) => {
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tarik daftar layanan aktif langsung dari tabel [Layanan_Medis] di database backend
    apiClient.post<{ success: boolean; data: any[] }>('/public/layanan/list', {})
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped: LayananItem[] = res.data.data.map((l: any) => {
            const rawNama = (l.nama || 'Layanan Medis').replace(/Dokter\s+Umum/gi, 'Penyakit Umum');
            const lowerNama = rawNama.toLowerCase();
            const lowerKat = (l.kategori || '').toLowerCase();

            let iconType = 'anc';
            if (lowerNama.includes('salin') || lowerKat.includes('salin')) {
              iconType = 'persalinan';
            } else if (lowerNama.includes('bbl') || lowerNama.includes('baru lahir') || lowerNama.includes('neonatal')) {
              iconType = 'bbl';
            } else if (lowerNama.includes('imun') || lowerNama.includes('vaksin')) {
              iconType = 'imunisasi';
            } else if (lowerNama.includes('kb') || lowerNama.includes('kontrasepsi') || lowerNama.includes('iud') || lowerNama.includes('implan')) {
              iconType = 'kb';
            } else if (lowerNama.includes('tumbuh') || lowerNama.includes('kembang')) {
              iconType = 'tumbuh';
            } else if (lowerNama.includes('umum') || lowerNama.includes('penyakit')) {
              iconType = 'umum';
            } else if (lowerNama.includes('lab') || lowerNama.includes('darah')) {
              iconType = 'lab';
            }

            return {
              layanan_id: l.layanan_id || l.kode || 'LAY-0',
              nama: rawNama,
              kategori: l.kategori || 'Kebidanan',
              deskripsi: l.deskripsi || `Layanan asuhan medis kebidanan ${rawNama} di Praktik Mandiri Bidan Ria Indrasti.`,
              durasi_menit: l.durasi_menit || 30,
              highlight: l.highlight || 'Pelayanan Standar Medis',
              icon: iconType,
              cakupan: []
            };
          });
          setLayananList(mapped);
        } else {
          setLayananList([]);
        }
      })
      .catch(() => {
        setLayananList([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'anc':
        // Ikon Kehamilan / ANC: Ibu hamil dengan detak jantung
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9 9 0 0 1-9-9c0-4.97 4.03-9 9-9 2.5 0 4.75 1.02 6.36 2.64"/>
            <path d="M16 11c1.5 0 3 1.5 3 3s-1.5 3-3 3"/>
            <path d="M12 7v6"/>
            <path d="M9 10h6"/>
          </svg>
        );
      case 'persalinan':
        // Ikon Persalinan Siaga 24 Jam: Kasur bersalin & cinta persalinan
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4v16"/>
            <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
            <path d="M2 17h20"/>
            <path d="M6 8v9"/>
            <circle cx="10" cy="12" r="2"/>
          </svg>
        );
      case 'bbl':
        // Ikon Bayi Baru Lahir (BBL): Wajah bayi mungil
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M9 10h.01"/>
            <path d="M15 10h.01"/>
            <path d="M10 15c.5.5 1.5.8 2 .8s1.5-.3 2-.8"/>
            <path d="M12 3a3 3 0 0 1 3 3"/>
          </svg>
        );
      case 'imunisasi':
        // Ikon Imunisasi: Suntikan vaksin & pelindung
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 2 4 4"/>
            <path d="m17 7 3-3"/>
            <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9"/>
            <path d="m9 9 6 6"/>
          </svg>
        );
      case 'kb':
        // Ikon KB / Kontrasepsi: Kalender & siklus pil perencanaan
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <circle cx="12" cy="15" r="2"/>
          </svg>
        );
      case 'tumbuh':
        // Ikon Tumbuh Kembang: Pertumbuhan dan grafik balita
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
            <circle cx="9" cy="7" r="2"/>
          </svg>
        );
      case 'umum':
        // Ikon Konsultasi Penyakit Umum: Stetoskop klinis
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3"/>
            <path d="M9 12.5v4.5a3 3 0 0 0 6 0v-4.5"/>
            <circle cx="15" cy="17" r="2"/>
            <circle cx="4.5" cy="3" r="1"/>
            <circle cx="13.5" cy="3" r="1"/>
          </svg>
        );
      case 'lab':
        // Ikon Pemeriksaan Lab / Penunjang Medis: Tabung reaksi
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v7.31M14 2v7.31"/>
            <path d="M8.5 2h7"/>
            <path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>
            <path d="M5.52 16h12.96"/>
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        );
    }
  };

  const isShowLoading = propLoading || loading;

  return (
    <section id="layanan" style={{ padding: '5.5rem 0', background: 'var(--bg-page)' }}>
      <div className="container">
        <div className="section-header">
          <div className="section-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Cakupan Asuhan Medis</span>
          </div>
          <h2 className="section-title">Layanan Asuhan Kebidanan</h2>
          <p className="section-subtitle">
            Pelayanan kebidanan menyeluruh bagi kesehatan ibu hamil, proses persalinan, 
            asuhan bayi baru lahir, dan perencanaan keluarga.
          </p>
        </div>

        {isShowLoading ? (
          <div className="services-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card-hover" style={{ padding: '1.85rem', height: '340px' }}>
                <div className="skeleton skeleton-icon" style={{ marginBottom: '1.25rem' }}></div>
                <div className="skeleton skeleton-badge" style={{ marginBottom: '0.75rem' }}></div>
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '85%' }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : layananList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '16px', border: '1px dashed var(--border-medium)', color: 'var(--color-slate-500)' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-slate-800)', marginBottom: '0.5rem' }}>
              Daftar Layanan Belum Tersedia
            </p>
            <p style={{ fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
              Silakan hubungi pihak klinik untuk informasi jenis layanan pemeriksaan hari ini.
            </p>
          </div>
        ) : (
          <div className="services-grid">
            {layananList.map((item) => (
              <div key={item.layanan_id} className="service-card card-hover">
                <div className="service-card-top">
                  <div className="service-icon-box icon-wrapper">
                    {renderIcon(item.icon)}
                  </div>

                  <span className="service-badge">
                    {item.highlight}
                  </span>

                  <h3 className="service-card-title">
                    {item.nama}
                  </h3>

                  <p className="service-card-desc">
                    {item.deskripsi}
                  </p>

                  {/* Scope Checklist (Opsional) */}
                  {item.cakupan && item.cakupan.length > 0 && (
                    <ul className="service-features-list">
                      {item.cakupan.map((cakup, idx) => (
                        <li key={idx} className="service-feature-item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>{cakup}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    type="button"
                    onClick={() => onSelectService(item)}
                    className="btn btn-secondary btn-shimmer"
                    style={{ width: '100%', fontSize: '0.875rem', justifyContent: 'center' }}
                  >
                    <span>Reservasi Layanan Ini</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { KLINIK_INFO } from '../constants/klinik';

interface HeaderProps {
  onOpenBooking?: () => void;
  onOpenLogin: (defaultRole?: 'admin' | 'bidan' | 'pasien') => void;
  isAuthenticated?: boolean;
  userName?: string;
  onGoToDashboard?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBooking: _onOpenBooking,
  onOpenLogin,
  isAuthenticated = false,
  userName = '',
  onGoToDashboard,
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="header-wrapper">
      {/* Top Emergency & Info Bar (Desktop & Tablet) */}
      <div className="top-bar">
        <div className="container top-bar-content">
          <div className="top-bar-item">
            <span className="pulse-indicator">
              <span className="pulse-indicator-ping"></span>
              <span className="pulse-indicator-dot"></span>
            </span>
            <span style={{ fontWeight: 700, color: '#fcd34d' }}>
              Siaga 24 Jam Penuh
            </span>
            <span style={{ color: '#475569', margin: '0 0.35rem' }}>•</span>
            <span className="top-bar-address" style={{ color: '#cbd5e1' }}>
              {KLINIK_INFO.alamat}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <a
              href={`tel:${KLINIK_INFO.telepon}`}
              className="top-bar-item"
              style={{ color: '#ffffff', fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span>Hotline 24 Jam: <strong>{KLINIK_INFO.telepon}</strong></span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className="main-nav">
        <div className="container nav-container">
          {/* Brand Logo & Name */}
          <a href="#beranda" className="brand-link" onClick={closeMobileMenu}>
            <img
              src="/logo-bidan.png"
              alt="Logo Praktik Mandiri Bidan Ria Indrasti"
              className="brand-logo-img"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('public/logo-bidan.png')) {
                  target.src = './public/logo-bidan.png';
                }
              }}
            />
            <div className="brand-text-block">
              <div className="brand-title">Praktik Mandiri Bidan</div>
              <div className="brand-subtitle">Ria Indrasti J., S.Keb.</div>
            </div>
          </a>

          {/* Desktop Navigation Links (Clean, No-Wrap) */}
          <ul className="nav-menu">
            <li><a href="#beranda" className="nav-link">Beranda</a></li>
            <li><a href="#layanan" className="nav-link">Layanan</a></li>
            <li><a href="#jadwal" className="nav-link">Jadwal &amp; Antrean</a></li>
            <li><a href="#fasilitas" className="nav-link">Fasilitas</a></li>
            <li><a href="#kontak" className="nav-link">Kontak</a></li>
          </ul>

          {/* Action Buttons */}
          <div className="nav-actions">
            {isAuthenticated && onGoToDashboard ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="btn btn-primary nav-portal-btn"
                  title="Kembali ke Dashboard Anda"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span>Dashboard{userName ? ` (${userName.split(' ')[0]})` : ''}</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="btn btn-secondary nav-portal-btn"
                    style={{ padding: '0.55rem 0.85rem', fontSize: '0.8125rem', color: '#dc2626' }}
                  >
                    Keluar
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenLogin('pasien')}
                className="btn btn-primary nav-portal-btn"
                title="Akses Portal Pasien, Bidan, atau Admin"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="5"/>
                  <path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
                <span>Masuk Portal</span>
              </button>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              className={`hamburger-btn ${mobileMenuOpen ? 'active' : ''}`}
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer">
            <div className="mobile-drawer-content">
              <ul className="mobile-nav-list">
                <li>
                  <a href="#beranda" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Beranda</span>
                  </a>
                </li>
                <li>
                  <a href="#layanan" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    <span>Layanan Kebidanan</span>
                  </a>
                </li>
                <li>
                  <a href="#jadwal" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>Jadwal Sesi & Kuota</span>
                  </a>
                </li>
                <li>
                  <a href="#antrean" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Cek Antrean Live</span>
                  </a>
                </li>
                <li>
                  <a href="#fasilitas" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Fasilitas Praktik</span>
                  </a>
                </li>
                <li>
                  <a href="#kontak" className="mobile-nav-link" onClick={closeMobileMenu}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>Lokasi & Kontak</span>
                  </a>
                </li>
              </ul>

              <div className="mobile-drawer-divider"></div>

              {/* Mobile Portal Access Links */}
              <div className="mobile-portal-section">
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Akses Sistem
                </div>
                {isAuthenticated && onGoToDashboard ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => { closeMobileMenu(); onGoToDashboard(); }}
                      className="btn btn-primary"
                      style={{ padding: '0.7rem', fontSize: '0.875rem', width: '100%' }}
                    >
                      Kembali ke Dashboard
                    </button>
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => { closeMobileMenu(); onLogout(); }}
                        className="btn btn-secondary"
                        style={{ padding: '0.65rem', fontSize: '0.8125rem', width: '100%', color: '#dc2626' }}
                      >
                        Keluar Akun
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => { closeMobileMenu(); onOpenLogin('pasien'); }}
                      className="btn btn-secondary"
                      style={{ padding: '0.65rem 0.5rem', fontSize: '0.8125rem', width: '100%' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                      <span>Portal Pasien</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { closeMobileMenu(); onOpenLogin('admin'); }}
                      className="btn btn-secondary"
                      style={{ padding: '0.65rem 0.5rem', fontSize: '0.8125rem', width: '100%' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span>Bidan / Admin</span>
                    </button>
                  </div>
                )}

                <a
                  href={`tel:${KLINIK_INFO.telepon}`}
                  className="mobile-hotline-btn"
                  style={{ marginTop: '0.75rem' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>Telepon Siaga 24 Jam: {KLINIK_INFO.telepon}</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

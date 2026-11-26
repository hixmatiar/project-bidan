import React from 'react';

interface MobileBottomNavProps {
  onOpenBooking: () => void;
  onOpenLogin: (defaultRole?: 'admin' | 'bidan' | 'pasien') => void;
  isAuthenticated?: boolean;
  onGoToDashboard?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenBooking,
  onOpenLogin,
  isAuthenticated = false,
  onGoToDashboard
}) => {
  return (
    <div className="mobile-bottom-nav">
      <div className="mobile-bottom-nav-inner">
        <a href="#beranda" className="bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Beranda</span>
        </a>

        <a href="#layanan" className="bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <span>Layanan</span>
        </a>

        {/* Highlighted Booking Button */}
        <button type="button" onClick={onOpenBooking} className="bottom-nav-booking-btn" aria-label="Daftar Antrean">
          <div className="bottom-nav-booking-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <span>Daftar</span>
        </button>

        <a href="#antrean" className="bottom-nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Antrean</span>
        </a>

        <button
          type="button"
          onClick={() => (isAuthenticated && onGoToDashboard ? onGoToDashboard() : onOpenLogin('pasien'))}
          className="bottom-nav-item"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="5"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
          <span>{isAuthenticated ? 'Dashboard' : 'Portal'}</span>
        </button>
      </div>
    </div>
  );
};

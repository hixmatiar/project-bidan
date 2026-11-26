import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { ScheduleSection } from '../components/ScheduleSection';
import { ServicesSection } from '../components/ServicesSection';
import { QueueStatusSection } from '../components/QueueStatusSection';
import { AboutSection } from '../components/AboutSection';
import { GallerySection } from '../components/GallerySection';
import { TestimonialSection } from '../components/TestimonialSection';
import { EducationSection } from '../components/EducationSection';
import { Footer } from '../components/Footer';
import { ReservationModal } from '../components/ReservationModal';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { LayananItem } from '../api/types';

interface PublicHomePageProps {
  onOpenLogin: (defaultRole?: 'admin' | 'bidan' | 'pasien') => void;
  isAuthenticated?: boolean;
  userName?: string;
  onGoToDashboard?: () => void;
  onLogout?: () => void;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  onOpenLogin,
  isAuthenticated = false,
  userName = '',
  onGoToDashboard,
  onLogout
}) => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedLayanan, setSelectedLayanan] = useState<LayananItem | null>(null);
  
  // Natural initial skeleton loading state (~800ms) without any artificial preview toolbar
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenBooking = () => {
    setSelectedLayanan(null);
    setIsBookingOpen(true);
  };

  const handleSelectService = (layanan: LayananItem) => {
    setSelectedLayanan(layanan);
    setIsBookingOpen(true);
  };

  return (
    <div className="public-home-wrapper">
      <Header
        onOpenBooking={handleOpenBooking}
        onOpenLogin={onOpenLogin}
        isAuthenticated={isAuthenticated}
        userName={userName}
        onGoToDashboard={onGoToDashboard}
        onLogout={onLogout}
      />

      <main>
        <Hero
          onOpenBooking={handleOpenBooking}
          isLoading={isPageLoading}
        />

        <ScheduleSection
          onOpenBooking={handleOpenBooking}
          isLoading={isPageLoading}
        />

        <ServicesSection
          onSelectService={handleSelectService}
          isLoading={isPageLoading}
        />

        <QueueStatusSection
          isLoading={isPageLoading}
        />

        <AboutSection />

        <GallerySection />

        <TestimonialSection
          isLoading={isPageLoading}
        />

        <EducationSection />
      </main>

      <Footer />

      <MobileBottomNav
        onOpenBooking={handleOpenBooking}
        onOpenLogin={onOpenLogin}
        isAuthenticated={isAuthenticated}
        onGoToDashboard={onGoToDashboard}
      />

      <ReservationModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        selectedLayanan={selectedLayanan}
      />
    </div>
  );
};

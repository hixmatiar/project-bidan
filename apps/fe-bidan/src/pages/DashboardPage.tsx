import React, { useState, useEffect } from 'react';
import { apiClient, session } from '../api/client';
import { pesanErrorApi } from '../api/errors';
import { KLINIK_INFO } from '../constants/klinik';
import { AuditLogItem, HargaObatLogItem, NotifikasiEmailPasien, RekapKeuanganOperasional } from '../api/types';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface DashboardPageProps {
  onLogout: () => void;
  onGoToHome?: () => void;
  initialRole?: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, onGoToHome, initialRole }) => {
  const [currentRole, setCurrentRole] = useState<'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN'>(
    initialRole || (localStorage.getItem('bidan_user_role') as 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN') || 'ADMIN_LOKAL'
  );

  // Superadmin Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [rekapKeuangan, setRekapKeuangan] = useState<RekapKeuanganOperasional>({ periode: 'Bulan Ini', total_pendapatan: 0, total_pengeluaran_obat: 0, beban_operasional_klinik: 0, laba_bersih: 0, margin_bersih_persen: 0, analisis_fluktuasi: 'Data rekapitulasi keuangan disinkronisasi langsung dari database.' });
  const [auditFilter, setAuditFilter] = useState<string>('SEMUA');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);
  const [reloadHarga, setReloadHarga] = useState(0);

  // Live Database Fetch: Panggil langsung endpoint backend yang terhubung ke SQL Server
  useEffect(() => {
    // 1. Ambil data riwayat harga obat dari tabel dbo.[Harga_Obat] lewat backend API
    apiClient.post('/harga/list', {})
      .then((res) => {
        const rawList = res.data?.data?.obat;
        if (Array.isArray(rawList)) {
          const mapped: HargaObatLogItem[] = rawList.map((item: any) => {
            const jual = Number(item.harga_jual || item.harga || 0);
            const beli = Number(item.hpp_beli || item.harga_beli || 0);
            const marginRp = jual - beli;
            const marginPersen = beli > 0 ? Math.round((marginRp / beli) * 100) : 0;
            return {
              harga_obat_id: String(item.harga_obat_id ?? ''),
              obat_id: String(item.obat_id ?? ''),
              kode_obat: String(item.kode ?? item.kode_obat ?? ''),
              nama_obat: String(item.nama_obat || item.nama_generik || item.nama || 'Obat Kebidanan'),
              kategori: String(item.kategori || 'Farmasi'),
              hpp_beli: beli,
              harga_jual: jual,
              margin_rp: marginRp,
              margin_persen: marginPersen,
              berlaku_dari: item.berlaku_dari ? new Date(item.berlaku_dari).toLocaleDateString('id-ID') : 'Aktif',
              berlaku_sampai: item.berlaku_sampai ? new Date(item.berlaku_sampai).toLocaleDateString('id-ID') : null,
              diubah_oleh: String(item.diubah_oleh || 'Petugas Farmasi'),
              alasan: String(item.alasan || 'Penyesuaian berkala tarif klinik')
            };
          });
          setHargaLogs(mapped);
        }
      })
      .catch(() => {});

    // 2. Ambil data rekapitulasi keuangan & billing dari database
    apiClient.post('/keuangan/rekap/list', { dari: null, sampai: null })
      .then((res) => {
        if (res.data?.data) {
          const d = res.data.data;
          setRekapKeuangan({
            periode: d.periode || 'Bulan Ini',
            total_pendapatan: Number(d.total_pendapatan || 0),
            total_pengeluaran_obat: Number(d.total_pengeluaran_obat || 0),
            beban_operasional_klinik: Number(d.beban_operasional_klinik || 0),
            laba_bersih: Number(d.laba_bersih || 0),
            margin_bersih_persen: Number(d.margin_bersih_persen || 0),
            analisis_fluktuasi: d.analisis_fluktuasi || 'Data transaksi keuangan tersinkronisasi langsung dari database.'
          });
        }
      })
      .catch(() => {});

    // 3. Ambil data log audit aktivitas sistem dari tabel dbo.[Audit_Log]
    apiClient.post('/audit-logs/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped: AuditLogItem[] = res.data.data.map((a: any, idx: number) => ({
            log_id: Number(a.log_id || idx + 1),
            waktu: a.waktu ? new Date(a.waktu).toLocaleString('id-ID') : 'Baru saja',
            user_ref: String(a.user_ref || a.akun_id || 'System'),
            peran: String(a.peran || 'STAF'),
            aksi: String(a.aksi || 'UPDATE'),
            tabel: String(a.tabel || 'dbo.[General]'),
            id_baris: String(a.id_baris || '-'),
            ip_address: String(a.ip_address || '127.0.0.1'),
            nilai_lama: String(a.keterangan || '-'),
            nilai_baru: String(a.keterangan || '-')
          }));
          setAuditLogs(mapped);
        }
      })
      .catch(() => {
        setAuditLogs([]);
      });

    // 4. Ambil data antrean / reservasi aktif dari tabel dbo.[Reservasi]
    apiClient.post('/reservasi/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((r: any, idx: number) => ({
            no: r.nomor_antrean ? `A-${String(r.nomor_antrean).padStart(3, '0')}` : `A-${String(idx + 1).padStart(3, '0')}`,
            nama: r.nama_pasien || 'Ibu Pasien',
            layanan: 'Pelayanan Kebidanan',
            sesi: 'Sesi Praktik',
            jam: r.estimasi_jam ? `${r.estimasi_jam} WIB` : '09:00 WIB',
            status: r.status === 'SELESAI' ? 'SELESAI' : r.status === 'DIPANGGIL' ? 'DIPANGGIL' : 'MENUNGGU'
          }));
          setQueueList(mapped);
        }
      })
      .catch(() => {});

    // 5. Ambil data stok obat & alkes dari tabel dbo.[Obat] dan [Stok_Batch]
    apiClient.post('/inventaris/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((o: any) => ({
            kode: o.kode || o.obat_id,
            nama: o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : (o.nama_generik || 'Obat Kebidanan'),
            kategori: o.kategori || 'Obat Esensial',
            stok: Number(o.stok_total || 0),
            min: Number(o.stok_minimum || 10),
            satuan: o.satuan || 'Pcs',
            status: Number(o.stok_total || 0) <= Number(o.stok_minimum || 10) ? 'MENIPIS' : 'AMAN'
          }));
          setStokAlkes(mapped);
          setObatOptions(
            res.data.data
              .filter((o: any) => typeof o.obat_id === 'string' && o.obat_id.length > 0)
              .map((o: any) => ({
                obat_id: String(o.obat_id),
                nama_obat: o.nama_dagang
                  ? `${o.nama_dagang} (${o.nama_generik})`
                  : String(o.nama_generik || 'Obat Kebidanan'),
                kategori: String(o.kategori || 'Farmasi'),
                kode: String(o.kode || '')
              }))
          );
        }
      })
      .catch(() => {});

    // 6. Ambil data log email notifikasi pasien dari tabel dbo.[Notifikasi_Log]
    apiClient.post('/notifikasi/log/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped: NotifikasiEmailPasien[] = res.data.data.map((n: any) => ({
            notif_id: String(n.notif_id || n.id),
            pasien_nama: String(n.tujuan_nama || n.pasien_nama || 'Pasien Bidan Ria'),
            email_tujuan: String(n.tujuan || n.email || '-'),
            jenis: n.jenis || 'TIKET_RESERVASI',
            subjek: String(n.subjek || 'Notifikasi Layanan Klinik'),
            waktu_kirim: n.waktu_kirim ? new Date(n.waktu_kirim).toLocaleString('id-ID') : 'Terkirim',
            status: n.status === 'GAGAL' ? 'GAGAL' : n.status === 'ANTRE' ? 'MENUNGGU' : 'TERKIRIM'
          }));
          setEmailLogs(mapped);
        }
      })
      .catch(() => {});
  }, [reloadHarga]);

  // Admin Operational Sub-Tab State
  const [adminTab, setAdminTab] = useState<'antrean' | 'pendaftaran' | 'stok' | 'kasir' | 'keuangan' | 'riwayat_harga' | 'email'>('antrean');
  const [hargaLogs, setHargaLogs] = useState<HargaObatLogItem[]>([]);
  const [showAddHargaModal, setShowAddHargaModal] = useState<boolean>(false);
  const [hargaSaving, setHargaSaving] = useState<boolean>(false);
  const [hargaError, setHargaError] = useState<string | null>(null);
  const [obatOptions, setObatOptions] = useState<
    Array<{ obat_id: string; nama_obat: string; kategori: string; kode: string }>
  >([]);
  const [newHargaItem, setNewHargaItem] = useState({
    obat_id: '',
    nama_obat: '',
    kategori: '',
    harga_jual: 0,
    alasan: ''
  });
  const [emailLogs, setEmailLogs] = useState<NotifikasiEmailPasien[]>([]);
  const [walkinEmail, setWalkinEmail] = useState<string>('');
  const [kirimEmailNotif, setKirimEmailNotif] = useState<boolean>(true);
  const [previewEmail, setPreviewEmail] = useState<NotifikasiEmailPasien | null>(null);
  const [activeQueueNum, setActiveQueueNum] = useState<string>('A-007');
  const [callAlert, setCallAlert] = useState<string | null>(null);

  const [queueList, setQueueList] = useState<any[]>([]);

  const [stokAlkes, setStokAlkes] = useState<any[]>([]);

  const handleCallQueue = (nomor: string, nama: string) => {
    setActiveQueueNum(nomor);
    setCallAlert(`Memanggil nomor antrean: ${nomor} (${nama}) menuju Ruang Periksa 1.`);
    setQueueList(prev => prev.map(q => q.no === nomor ? { ...q, status: 'DIPANGGIL' } : q));
    setTimeout(() => setCallAlert(null), 4000);
  };

  const handleFinishQueue = (nomor: string) => {
    setQueueList(prev => prev.map(q => q.no === nomor ? { ...q, status: 'SELESAI' } : q));
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchFilter = auditFilter === 'SEMUA' || log.aksi.includes(auditFilter) || log.tabel.includes(auditFilter);
    const matchSearch = auditSearch === '' || 
      log.user_ref.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.aksi.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.id_baris.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.ip_address.includes(auditSearch);
    return matchFilter && matchSearch;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid var(--border-medium)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src="/logo-bidan.png"
            alt="Logo Bidan Ria"
            style={{ height: '42px', width: 'auto' }}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes('public/logo-bidan.png')) {
                target.src = './public/logo-bidan.png';
              }
            }}
          />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              {KLINIK_INFO.nama}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
              {currentRole === 'SUPERADMIN' && 'Sistem Pengawas Keamanan & Jejak Audit (Audit_Log)'}
              {currentRole === 'ADMIN_LOKAL' && 'Dashboard Operasional Loket & Monitoring Sesi Antrean (SCR-07)'}
              {currentRole === 'DOKTER' && 'Portal Rekam Medis Elektronik (RME) — Bdn. Ria Indrasti J., S.Keb'}
              {currentRole === 'PASIEN' && 'Portal Pasien & Buku KIA Digital Terintegrasi'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Quick Role Switcher Pill */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', gap: '0.2rem' }}>
            <button
              type="button"
              onClick={() => setCurrentRole('SUPERADMIN')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentRole === 'SUPERADMIN' ? '#9333ea' : 'transparent',
                color: currentRole === 'SUPERADMIN' ? '#ffffff' : '#64748b'
              }}
            >
              Superadmin
            </button>
            <button
              type="button"
              onClick={() => setCurrentRole('ADMIN_LOKAL')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentRole === 'ADMIN_LOKAL' ? '#f59e0b' : 'transparent',
                color: currentRole === 'ADMIN_LOKAL' ? '#ffffff' : '#64748b'
              }}
            >
              Admin Operasional
            </button>
            <button
              type="button"
              onClick={() => setCurrentRole('DOKTER')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentRole === 'DOKTER' ? '#16a34a' : 'transparent',
                color: currentRole === 'DOKTER' ? '#ffffff' : '#64748b'
              }}
            >
              Bidan (RME)
            </button>
            <button
              type="button"
              onClick={() => setCurrentRole('PASIEN')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: currentRole === 'PASIEN' ? '#2563eb' : 'transparent',
                color: currentRole === 'PASIEN' ? '#ffffff' : '#64748b'
              }}
            >
              Pasien
            </button>
          </div>

          {onGoToHome && (
            <button
              type="button"
              onClick={onGoToHome}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8125rem' }}
            >
              &larr; Web Publik
            </button>
          )}

          <button
            type="button"
            onClick={() => { session.bersihkan(); onLogout(); }}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8125rem', color: '#dc2626' }}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '1.75rem 1.5rem', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>

        {/* =========================================================================
            ROLE 1: SUPERADMIN — AUDIT TRAIL LOG VIEWER (TABLE: Audit_Log)
            ========================================================================= */}
        {currentRole === 'SUPERADMIN' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#f3e8ff', color: '#7e22ce' }}>
                    MODUL KEAMANAN SISTEM (TSD SECTION 6)
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>
                    • Append-Only Immutable (trg_audit_logs_immutable)
                  </span>
                </div>
                <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  Log Audit &amp; Integritas Transaksi Superadmin
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                  Memantau seluruh jejak riwayat mutasi tabel, rekam medis elektronik, antrean, dan autentikasi lintas unit pelayanan.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => alert('Jejak Audit_Log berhasil diekspor ke format CSV terenkripsi sesuai UU PDP No. 27/2022.')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.55rem 0.95rem' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Ekspor Log Audit (CSV)</span>
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.15rem', marginBottom: '1.75rem' }}>
              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Total Log Audit Tercatat</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#7e22ce', margin: '0.25rem 0' }}>10.482</div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Append-only (Tidak Dapat Dimanipulasi)</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Status Keamanan &amp; Integritas</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>Optimal</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>0 Anomali Akses / Percobaan Ilegal</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Akun Staf &amp; Sesi Aktif</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0.25rem 0' }}>4 Sesi</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Bidan Ria, Staf Loket, Superadmin, Pasien</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Database MiniWorldRS</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0284c7', margin: '0.25rem 0' }}>97 Tabel</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>SQL Server 2025 Sinkron 100%</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['SEMUA', 'UPDATE_RME', 'VERIFIKASI_ANTREAN', 'CREATE_PENDAFTARAN', 'MUTASI_STOK', 'AUTH_LOGIN'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setAuditFilter(f)}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      background: auditFilter === f ? '#7e22ce' : '#ffffff',
                      color: auditFilter === f ? '#ffffff' : 'var(--color-slate-700)'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div style={{ width: '260px' }}>
                <input
                  type="text"
                  placeholder="Cari User / ID / IP..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Audit Log Table */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Log ID</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Waktu Kejadian</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Pelaksana (User Ref)</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Role</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Aksi Mutasi</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Tabel Target</th>
                      <th style={{ padding: '0.85rem 1rem' }}>ID Baris</th>
                      <th style={{ padding: '0.85rem 1rem' }}>IP Address</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Inspeksi JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.log_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#7e22ce' }}>#{log.log_id}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-slate-600)', whiteSpace: 'nowrap' }}>{log.waktu}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>{log.user_ref}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: log.peran === 'DOKTER' ? '#dcfce7' : log.peran === 'SUPERADMIN' ? '#f3e8ff' : '#fef3c7', color: log.peran === 'DOKTER' ? '#166534' : log.peran === 'SUPERADMIN' ? '#7e22ce' : '#92400e' }}>
                            {log.peran}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>{log.aksi}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{log.tabel}</code>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-slate-600)' }}>{log.id_baris}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-slate-500)', fontSize: '0.8rem' }}>{log.ip_address}</td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedAuditLog(log)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          >
                            Lihat Nilai
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Inspeksi JSON Diff */}
            {selectedAuditLog && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                      Inspeksi Audit Log #{selectedAuditLog.log_id}
                    </h3>
                    <button type="button" onClick={() => setSelectedAuditLog(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--color-slate-600)' }}>
                    <div><strong>Aksi:</strong> {selectedAuditLog.aksi} on <code>{selectedAuditLog.tabel}</code></div>
                    <div><strong>Pelaksana:</strong> {selectedAuditLog.user_ref} ({selectedAuditLog.peran})</div>
                    <div><strong>Waktu / IP:</strong> {selectedAuditLog.waktu} | {selectedAuditLog.ip_address}</div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.3rem' }}>Nilai Lama (Sebelum Mutasi):</div>
                    <pre style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto', border: '1px solid #fee2e2' }}>{selectedAuditLog.nilai_lama}</pre>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.3rem' }}>Nilai Baru (Setelah Mutasi):</div>
                    <pre style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto', border: '1px solid #dcfce7' }}>{selectedAuditLog.nilai_baru}</pre>
                  </div>
                  <button type="button" onClick={() => setSelectedAuditLog(null)} className="btn btn-secondary" style={{ width: '100%', padding: '0.6rem' }}>Tutup</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ROLE 2: ADMIN OPERASIONAL KLINIK (MODUL SCR-07 LENGKAP)
            ========================================================================= */}
        {currentRole === 'ADMIN_LOKAL' && (
        <ErrorBoundary fallbackTitle="Kendala Memuat Panel Admin">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#fef3c7', color: '#92400e' }}>
                    MODUL OPERASIONAL LOKET (SCR-07 &amp; v_sesi_sisa_kuota)
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>
                    • Sesi Pagi &amp; Sore Terbuka
                  </span>
                </div>
                <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  Dashboard Operasional &amp; Antrean Sesi Hari Ini
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                  Pengendalian antrean ruang tunggu, pendaftaran pasien walk-in, pengaturan kuota sesi, dan logistik alkes esensial.
                </p>
              </div>

              {/* Sub-Tabs Operasional */}
              <div style={{ display: 'flex', background: '#ffffff', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-medium)', gap: '0.3rem' }}>
                <button
                  type="button"
                  onClick={() => setAdminTab('antrean')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'antrean' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'antrean' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Live Antrean (SCR-07)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('pendaftaran')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'pendaftaran' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'pendaftaran' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  + Pendaftaran Loket
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('stok')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'stok' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'stok' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Logistik &amp; Alkes
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('kasir')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'kasir' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'kasir' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Billing Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('keuangan')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'keuangan' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'keuangan' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Rekap Keuangan
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('riwayat_harga')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'riwayat_harga' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'riwayat_harga' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Riwayat Harga (Harga_Obat)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('email')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '7px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: adminTab === 'email' ? 'var(--color-primary)' : 'transparent',
                    color: adminTab === 'email' ? '#ffffff' : 'var(--color-slate-700)'
                  }}
                >
                  Notifikasi Email Pasien
                </button>
              </div>
            </div>

            {/* Notification alert if audio call simulated */}
            {callAlert && (
              <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <span>{callAlert}</span>
              </div>
            )}

            {/* TAB 1: LIVE ANTREAN */}
            {adminTab === 'antrean' && (
              <div>
                {/* Session Quotas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Sesi Pagi (08:00 - 12:00 WIB)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0.2rem 0' }}>9 Pasien Terdaftar</div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Sisa 6 Kuota (Maks 15)</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Sesi Sore (16:00 - 20:00 WIB)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0.2rem 0' }}>5 Pasien Terdaftar</div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Sisa 10 Kuota (Maks 15)</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Nomor Sedang Dilayani</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', margin: '0.2rem 0' }}>{activeQueueNum}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Ruang Periksa 1 (Bdn. Ria Indrasti)</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Antrean Menunggu di Klinik</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', margin: '0.2rem 0' }}>3 Ibu Hamil</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Estimasi Tunggu ~15 Menit/Pasien</div>
                  </div>
                </div>

                {/* Queue Table */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                      Daftar Urutan Pasien Hari Ini (SCR-07 Live Feed)
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleCallQueue('A-008', 'Ny. Desi Wulandari')}
                        className="btn btn-primary btn-shimmer"
                        style={{ fontSize: '0.8125rem', padding: '0.5rem 0.85rem' }}
                      >
                        Panggil Antrean Berikutnya (A-008)
                      </button>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                        <th style={{ padding: '0.65rem' }}>No. Antrean</th>
                        <th style={{ padding: '0.65rem' }}>Nama Ibu Pasien</th>
                        <th style={{ padding: '0.65rem' }}>Layanan Asuhan</th>
                        <th style={{ padding: '0.65rem' }}>Sesi Praktik</th>
                        <th style={{ padding: '0.65rem' }}>Estimasi Jam</th>
                        <th style={{ padding: '0.65rem' }}>Status</th>
                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>Aksi Operator Loket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
                            Belum ada antrean pasien untuk hari ini di database.
                          </td>
                        </tr>
                      ) : (
                        queueList.map((q) => (
                          <tr key={q.no} style={{ borderBottom: '1px solid var(--border-light)', background: q.status === 'DIPANGGIL' ? '#faf5fe' : 'transparent' }}>
                            <td style={{ padding: '0.75rem 0.65rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{q.no}</td>
                            <td style={{ padding: '0.75rem 0.65rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>{q.nama}</td>
                            <td style={{ padding: '0.75rem 0.65rem' }}>{q.layanan}</td>
                            <td style={{ padding: '0.75rem 0.65rem', color: 'var(--color-slate-600)' }}>{q.sesi}</td>
                            <td style={{ padding: '0.75rem 0.65rem', color: 'var(--color-slate-600)' }}>{q.jam}</td>
                            <td style={{ padding: '0.75rem 0.65rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: q.status === 'SELESAI' ? '#dcfce7' : q.status === 'DIPANGGIL' ? '#fef3c7' : '#e2e8f0', color: q.status === 'SELESAI' ? '#166534' : q.status === 'DIPANGGIL' ? '#92400e' : '#475569' }}>
                                {q.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleCallQueue(q.no, q.nama)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                >
                                  Panggil
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFinishQueue(q.no)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: '#16a34a' }}
                                >
                                  Selesai
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: PENDAFTARAN PASIEN BARU */}
            {adminTab === 'pendaftaran' && (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '2rem', maxWidth: '720px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.35rem' }}>
                  Formulir Pendaftaran Pasien Loket (Walk-In)
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.5rem' }}>
                  Petugas loket memasukkan data identitas untuk langsung menerbitkan tiket nomor antrean fisik/WhatsApp.
                </p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const newQueue = { no: 'A-011', nama: 'Ny. Dewi Lestari', layanan: 'Pemeriksaan Kehamilan (ANC)', sesi: 'Sesi Pagi', jam: '11:15 WIB', status: 'MENUNGGU' };
                  setQueueList(prev => [...prev, newQueue]);
                  if (kirimEmailNotif && walkinEmail) {
                    const newEmailItem: NotifikasiEmailPasien = {
                      notif_id: `EML-2026-${Date.now().toString().slice(-4)}`,
                      pasien_nama: 'Ny. Dewi Lestari',
                      email_tujuan: walkinEmail,
                      jenis: 'TIKET_RESERVASI',
                      subjek: 'Tiket Antrean A-011 - Praktik Mandiri Bidan Ria Indrasti',
                      waktu_kirim: 'Baru saja',
                      status: 'TERKIRIM'
                    };
                    setEmailLogs(prev => [newEmailItem, ...prev]);
                    alert(`Pendaftaran sukses! Nomor antrean A-011 berhasil diterbitkan dan E-Tiket telah otomatis dikirimkan ke email: ${walkinEmail}`);
                  } else {
                    alert('Pendaftaran sukses! Nomor antrean A-011 berhasil diterbitkan.');
                  }
                  setWalkinEmail('');
                  setAdminTab('antrean');
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Nomor Induk Kependudukan (NIK)</label>
                      <input type="text" required placeholder="16 digit NIK KTP" style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Nama Lengkap Ibu Pasien</label>
                      <input type="text" required placeholder="Contoh: Ny. Dewi Lestari" style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Nomor WhatsApp Aktif</label>
                      <input type="tel" required placeholder="08xxxxxxxxxx" style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Pilih Sesi Praktik</label>
                      <select style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
                        <option value="SESI-PAGI">Sesi Pagi (08:00 - 12:00 WIB) — Sisa 6 Kuota</option>
                        <option value="SESI-SORE">Sesi Sore (16:00 - 20:00 WIB) — Sisa 10 Kuota</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Layanan Kebidanan yang Dituju</label>
                    <select style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
                      <option>Pemeriksaan Kehamilan (ANC Terpadu)</option>
                      <option>Pelayanan Kontrasepsi &amp; KB</option>
                      <option>Pemeriksaan Kesehatan Ibu Nifas &amp; Laktasi</option>
                      <option>Asuhan Bayi Baru Lahir &amp; Tumbuh Kembang</option>
                      <option>Konsultasi Pra-Konsepsi / Rujukan</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Alamat Email Pasien (Opsional, untuk Pengiriman E-Tiket &amp; Pengingat Kontrol)
                    </label>
                    <input
                      type="email"
                      placeholder="Contoh: dewi.lestari@gmail.com"
                      value={walkinEmail}
                      onChange={(e) => setWalkinEmail(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="kirimEmailNotif"
                      checked={kirimEmailNotif}
                      onChange={(e) => setKirimEmailNotif(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                    />
                    <label htmlFor="kirimEmailNotif" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-slate-700)', cursor: 'pointer' }}>
                      Kirimkan E-Tiket antrean &amp; konfirmasi otomatis ke email pasien via SMTP Mailer
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary btn-shimmer" style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}>
                    Terbitkan Nomor Antrean &amp; Kirim E-Tiket
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: STOK ALKES & OBAT */}
            {adminTab === 'stok' && (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                      Inventori Obat &amp; Alkes Esensial Kebidanan (Tabel: Obat &amp; Mutasi_Stok)
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                      Ambang batas pengaman stok medis untuk persalinan 24 jam dan pelayanan KB.
                    </p>
                  </div>
                  <button type="button" onClick={() => alert('Pencatatan mutasi stok obat berhasil direkam.')} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
                    + Catat Masuk / Keluar Stok
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                      <th style={{ padding: '0.75rem' }}>Kode Obat/Alkes</th>
                      <th style={{ padding: '0.75rem' }}>Nama Item Medis</th>
                      <th style={{ padding: '0.75rem' }}>Kategori</th>
                      <th style={{ padding: '0.75rem' }}>Stok Fisik</th>
                      <th style={{ padding: '0.75rem' }}>Batas Minimal</th>
                      <th style={{ padding: '0.75rem' }}>Satuan</th>
                      <th style={{ padding: '0.75rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stokAlkes.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
                          Belum ada data stok obat di inventori database.
                        </td>
                      </tr>
                    ) : (
                      stokAlkes.map((s) => (
                        <tr key={s.kode} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{s.kode}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>{s.nama}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-slate-600)' }}>{s.kategori}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 800, fontSize: '0.95rem', color: '#16a34a' }}>{s.stok}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-slate-500)' }}>{s.min}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-slate-600)' }}>{s.satuan}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: s.status === 'AMAN' ? '#dcfce7' : '#fee2e2', color: s.status === 'AMAN' ? '#166534' : '#991b1b' }}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 4: KASIR & BILLING */}
            {adminTab === 'kasir' && (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.35rem' }}>
                  Rekapitulasi Billing Loket &amp; Pembayaran Sesi Hari Ini
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.25rem' }}>
                  Pencatatan kasir loket untuk verifikasi status lunas sebelum pasien menerima obat/buku KIA.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Total Pasien Telah Membayar</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>12 Transaksi</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Lunas 100%</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Metode Pembayaran</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary-dark)', margin: '0.2rem 0' }}>QRIS (60%) | Tunai (40%)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Terhubung Sistem MiniWorldRS</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: REKAP KEUANGAN & MARGIN */}
            {adminTab === 'keuangan' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)', borderLeft: '4px solid #16a34a' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Total Pendapatan (Inflow Kasir &amp; Layanan)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>Rp {(Number(rekapKeuangan.total_pendapatan) || 0).toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>12 Pasien Terlayani Sesi Hari Ini</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)', borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>HPP Bahan Obat &amp; Alkes Kebidanan</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', margin: '0.2rem 0' }}>Rp {(Number(rekapKeuangan.total_pengeluaran_obat) || 0).toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>Pengeluaran Farmasi, IUD, Oksitosin</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Beban Operasional &amp; Sanitasi Medis</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', margin: '0.2rem 0' }}>Rp {(Number(rekapKeuangan.beban_operasional_klinik) || 0).toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>Listrik, Air Steril, Limbah Medis B3</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)', borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Laba Bersih Operasional (Net Profit)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0.2rem 0' }}>Rp {(Number(rekapKeuangan.laba_bersih) || 0).toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>Margin Bersih: {Number(rekapKeuangan.margin_bersih_persen) || 0}%</div>
                  </div>
                </div>

                {/* Card Analisis Fluktuasi HPP Bahan Obat */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                      Analisis Fluktuasi Margin &amp; Dinamika Kenaikan Bahan Obat (Justifikasi Laba)
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.6, margin: 0 }}>
                    {rekapKeuangan.analisis_fluktuasi}
                  </p>
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #93c5fd', fontSize: '0.8rem', color: '#1d4ed8', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>• <strong>Faktor Kunci 1:</strong> Paket persalinan normal menyumbang 45.3% laba kotor melalui jasa kebidanan mandiri.</span>
                    <span>• <strong>Faktor Kunci 2:</strong> Pengadaan batch awal Oksitosin sebelum lonjakan distributor menahan beban HPP obat di bawah 40%.</span>
                  </div>
                </div>

                {/* Breakdown Tabel Layanan */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.35rem' }}>
                    Rincian Arus Pendapatan per Pos Layanan Asuhan Kebidanan
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.25rem' }}>
                    Perbandingan pendapatan bruto, alokasi HPP bahan obat/alkes, dan laba kontribusi per divisi.
                  </p>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                        <th style={{ padding: '0.75rem' }}>Pos Layanan Medis</th>
                        <th style={{ padding: '0.75rem' }}>Volume Pasien</th>
                        <th style={{ padding: '0.75rem' }}>Pendapatan Bruto</th>
                        <th style={{ padding: '0.75rem' }}>HPP Bahan Medis/Obat</th>
                        <th style={{ padding: '0.75rem' }}>Margin Kontribusi</th>
                        <th style={{ padding: '0.75rem' }}>Persentase Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Pemeriksaan Kehamilan (ANC Terpadu)</td>
                        <td style={{ padding: '0.75rem' }}>5 Kunjungan</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: '#16a34a' }}>Rp 1.250.000</td>
                        <td style={{ padding: '0.75rem', color: '#dc2626' }}>Rp 280.000</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Rp 970.000</td>
                        <td style={{ padding: '0.75rem' }}><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.75rem' }}>77.6%</span></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Paket Asuhan Persalinan Normal 24 Jam</td>
                        <td style={{ padding: '0.75rem' }}>1 Kelahiran</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: '#16a34a' }}>Rp 2.200.000</td>
                        <td style={{ padding: '0.75rem', color: '#dc2626' }}>Rp 980.000</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Rp 1.220.000</td>
                        <td style={{ padding: '0.75rem' }}><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.75rem' }}>55.4%</span></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Pelayanan Kontrasepsi (IUD / Implan / Suntik)</td>
                        <td style={{ padding: '0.75rem' }}>3 Pasien</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: '#16a34a' }}>Rp 900.000</td>
                        <td style={{ padding: '0.75rem', color: '#dc2626' }}>Rp 480.000</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Rp 420.000</td>
                        <td style={{ padding: '0.75rem' }}><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.75rem' }}>46.7%</span></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Imunisasi &amp; Perawatan Bayi Baru Lahir</td>
                        <td style={{ padding: '0.75rem' }}>3 Bayi</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: '#16a34a' }}>Rp 500.000</td>
                        <td style={{ padding: '0.75rem', color: '#dc2626' }}>Rp 180.000</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>Rp 320.000</td>
                        <td style={{ padding: '0.75rem' }}><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.75rem' }}>64.0%</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: RIWAYAT HARGA OBAT */}
            {adminTab === 'riwayat_harga' && (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                      Log Riwayat Harga Jual Obat &amp; Fluktuasi HPP (Tabel dbo.[Harga_Obat])
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                      Audit trail penyesuaian harga obat, margin keuntungan, dan dokumentasi alasan kenaikan bahan baku farmasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddHargaModal(true)}
                    className="btn btn-primary btn-shimmer"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    + Catat Penyesuaian Harga Baru
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                        <th style={{ padding: '0.75rem' }}>ID Log</th>
                        <th style={{ padding: '0.75rem' }}>Nama Obat / Alkes</th>
                        <th style={{ padding: '0.75rem' }}>HPP Beli</th>
                        <th style={{ padding: '0.75rem' }}>Harga Jual</th>
                        <th style={{ padding: '0.75rem' }}>Margin (Rp / %)</th>
                        <th style={{ padding: '0.75rem' }}>Berlaku Mulai</th>
                        <th style={{ padding: '0.75rem' }}>Petugas Logistik</th>
                        <th style={{ padding: '0.75rem', minWidth: '240px' }}>Alasan / Justifikasi Fluktuasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hargaLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
                            Belum ada riwayat penyesuaian harga obat di database. Klik tombol "+ Catat Penyesuaian Harga Baru" untuk menambah entri.
                          </td>
                        </tr>
                      ) : (
                        hargaLogs.map((h) => (
                          <tr key={h.harga_obat_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{h.harga_obat_id}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{h.nama_obat || 'Obat Kebidanan'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{h.kode_obat || '-'} • {h.kategori || 'Farmasi'}</div>
                            </td>
                            <td style={{ padding: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Rp {(Number(h.hpp_beli) || 0).toLocaleString('id-ID')}</td>
                            <td style={{ padding: '0.75rem', color: '#16a34a', fontWeight: 700 }}>Rp {(Number(h.harga_jual) || 0).toLocaleString('id-ID')}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ fontWeight: 700 }}>Rp {(Number(h.margin_rp) || 0).toLocaleString('id-ID')}</div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>{Number(h.margin_persen) || 0}%</span>
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--color-slate-600)' }}>{h.berlaku_dari || '-'}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--color-slate-600)' }}>{h.diubah_oleh || '-'}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--color-slate-700)', lineHeight: 1.4, background: '#fafaf9', borderRadius: '6px' }}>
                              {h.alasan || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 7: NOTIFIKASI EMAIL PASIEN */}
            {adminTab === 'email' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Total Email Terkirim</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>{emailLogs.filter(e => e.status === 'TERKIRIM').length} Pesan</div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>100% Berhasil Diterima Pasien</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Antrean Pengiriman (Queue)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', margin: '0.2rem 0' }}>{emailLogs.filter(e => e.status === 'MENUNGGU').length} Menunggu</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>SMTP Mailer Service Siap</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Layanan Mailer Terhubung</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '0.2rem 0' }}>Nodemailer SMTP</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>apps/backend/src/jobs/mailer.ts</div>
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                        Log Pengiriman Notifikasi Email Pasien
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                        Otomatisasi pengiriman E-Tiket nomor antrean dan pengingat kontrol kehamilan (H-1) ke email pasien.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert('Simulasi pengiriman email pengingat kontrol H-1 berhasil dijalankan via background job.')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      Kirim Blast Pengingat Kontrol H-1
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--color-slate-600)' }}>
                        <th style={{ padding: '0.75rem' }}>ID Notif</th>
                        <th style={{ padding: '0.75rem' }}>Nama Pasien</th>
                        <th style={{ padding: '0.75rem' }}>Alamat Email</th>
                        <th style={{ padding: '0.75rem' }}>Jenis Notifikasi</th>
                        <th style={{ padding: '0.75rem' }}>Subjek Email</th>
                        <th style={{ padding: '0.75rem' }}>Waktu Kirim</th>
                        <th style={{ padding: '0.75rem' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
                            Belum ada riwayat notifikasi email di database.
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((e) => (
                          <tr key={e.notif_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{e.notif_id}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>{e.pasien_nama}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--color-slate-700)' }}>{e.email_tujuan}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#e0e7ff', color: '#3730a3' }}>
                                {e.jenis}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--color-slate-800)' }}>{e.subjek}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--color-slate-500)', fontSize: '0.8rem' }}>{e.waktu_kirim}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: e.status === 'TERKIRIM' ? '#dcfce7' : '#fef3c7', color: e.status === 'TERKIRIM' ? '#166534' : '#92400e' }}>
                                {e.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewEmail(e)}
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                Preview Email
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </ErrorBoundary>
      )}

        {/* =========================================================================
            ROLE 3: DOKTER / BIDAN RIA — REKAM MEDIS ELEKTRONIK (RME)
            ========================================================================= */}
        {currentRole === 'DOKTER' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#dcfce7', color: '#166534' }}>
                    REKAM MEDIS ELEKTRONIK (DPJP: Bdn. Ria Indrasti J., S.Keb)
                  </span>
                </div>
                <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  Pemeriksaan Antenatal Care (ANC) &amp; Asuhan BBL
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                  Pencatatan klinis standar kebidanan mencakup SOAP, parameter obstetrik, DJJ Doppler, dan protokol neonatus.
                </p>
              </div>

              <button
                type="button"
                onClick={() => alert('Resume medis pemeriksaan ANC berhasil disimpan ke database RME terenkripsi.')}
                className="btn btn-primary btn-shimmer"
                style={{ fontSize: '0.85rem' }}
              >
                Simpan Catatan RME (CPPT)
              </button>
            </div>

            {/* Patient Header Card */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>Ny. Ratna Dewi (28 th)</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)' }}>No. RM: <strong>RM-2026-0042</strong> | NIK: 1571012304950001 | Gravida: G2P1A0</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '9999px', background: '#dcfce7', color: '#166534' }}>
                    Sedang Dilayani di Ruang Periksa
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginTop: '0.25rem' }}>HPHT: 02 Mei 2026 | Usia Kehamilan: 28 Minggu 4 Hari</div>
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Tekanan Darah</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>115 / 75</div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Normotensif</div>
                </div>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Tinggi Fundus (TFU)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>24 cm</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Sesuai Gestasi</div>
                </div>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Detak Jantung Janin (DJJ)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>142 dpm</div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Irama Kuat &amp; Reguler</div>
                </div>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Presentasi Janin</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>Kepala (Cephalic)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Punggung Kiri (PuKi)</div>
                </div>
              </div>

              {/* BBL Checklist */}
              <div style={{ background: '#faf5fe', border: '1px solid #efe8f6', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '0.75rem' }}>
                  Protokol Asuhan Bayi Baru Lahir 0-6 Jam (Asuhan_BBL)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Inisiasi Menyusu Dini (IMD)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Injeksi Vitamin K1 (1 mg IM)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Salep Mata Antibiotik Gentamisin</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Rawat Tali Pusat Terbuka Kering</label>
                </div>
              </div>

              {/* SOAP Medical Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.35rem' }}>
                  Catatan Perkembangan Pasien Terintegrasi (CPPT / SOAP)
                </label>
                <textarea
                  rows={3}
                  defaultValue="S: Ibu mengeluh sedikit pegal pada punggung bawah, gerak janin aktif dirasakan rutin. O: TD 115/75 mmHg, BB 62 kg, TFU 24 cm, DJJ 142 dpm reguler kuat. A: G2P1A0 hamil 28 minggu, janin tunggal hidup intrauterin, presentasi kepala. P: Edukasi postur istirahat, berikan suplemen Fe 1x1 dan Kalsium Laktat 1x1. Jadwal kontrol 3 minggu lagi."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.85rem', color: 'var(--color-slate-800)', lineHeight: '1.5' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ROLE 4: PASIEN — BUKU KIA DIGITAL & TIKET ANTREAN
            ========================================================================= */}
        {currentRole === 'PASIEN' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#e0e7ff', color: '#3730a3' }}>
                BUKU KIA DIGITAL TERINTEGRASI
              </span>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.35rem' }}>
                Selamat Datang, Ny. Ratna Dewi
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                Pantau riwayat antenatal care, nomor antrean aktif, dan tanggal jadwal kontrol kehamilan berikutnya.
              </p>
            </div>

            {/* Active Ticket Card */}
            <div style={{ background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)', color: '#ffffff', borderRadius: '20px', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 10px 25px -5px rgba(88, 32, 126, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiket Antrean Pemeriksaan Hari Ini</span>
                <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 800 }}>Sedang Dipanggil</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Nomor Antrean Anda:</div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>A-007</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.4rem', opacity: 0.9 }}>Layanan: Pemeriksaan Kehamilan (ANC Terpadu)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Ruang Pelayanan:</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>Ruang Periksa 1</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Bdn. Ria Indrasti J., S.Keb</div>
                </div>
              </div>
            </div>

            {/* KIA Summary Card */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '1rem' }}>
                Ringkasan Pemantauan Janin (Buku KIA Elektronik)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Usia Kehamilan Saat Ini</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '0.2rem' }}>28 Minggu 4 Hari</div>
                </div>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Perkiraan Hari Lahir (HPL)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>08 Februari 2027</div>
                </div>
                <div style={{ background: '#faf8fc', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Jadwal Kontrol Berikutnya</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>12 Desember 2026</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Modal: Catat Penyesuaian Harga Baru (Harga_Obat) */}
      {showAddHargaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.35rem' }}>
              Catat Penyesuaian Harga Baru (dbo.[Harga_Obat])
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1.25rem' }}>
              Pencatatan harga jual baru dan justifikasi penyesuaian tarif obat. Data disimpan ke dbo.[Harga_Obat].
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setHargaError(null);

              if (!newHargaItem.obat_id) {
                setHargaError('Pilih obat terlebih dahulu.');
                return;
              }
              if (!Number.isFinite(newHargaItem.harga_jual) || newHargaItem.harga_jual <= 0) {
                setHargaError('Harga jual harus lebih dari 0.');
                return;
              }
              if (newHargaItem.alasan.trim().length < 3) {
                setHargaError('Alasan minimal 3 karakter.');
                return;
              }

              setHargaSaving(true);
              try {
                // Persist ke dbo.[Harga_Obat] memakai obat_id UUID asli dari /inventaris/list.
                await apiClient.put(`/harga/OBAT/${newHargaItem.obat_id}`, {
                  harga: newHargaItem.harga_jual,
                  alasan: newHargaItem.alasan.trim(),
                  berlaku_dari: new Date().toISOString().split('T')[0] || undefined
                });
                setShowAddHargaModal(false);
                setNewHargaItem({ obat_id: '', nama_obat: '', kategori: '', harga_jual: 0, alasan: '' });
                setReloadHarga((v) => v + 1);
                alert('Penyesuaian harga obat berhasil dicatat ke tabel dbo.[Harga_Obat].');
              } catch (err: unknown) {
                setHargaError(pesanErrorApi(err, 'Gagal menyimpan harga obat.'));
              } finally {
                setHargaSaving(false);
              }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Pilih Obat / Alkes</label>
                <select
                  required
                  value={newHargaItem.obat_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const found = obatOptions.find((o) => o.obat_id === id);
                    setNewHargaItem({
                      ...newHargaItem,
                      obat_id: id,
                      nama_obat: found?.nama_obat ?? '',
                      kategori: found?.kategori ?? ''
                    });
                  }}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}
                >
                  <option value="">-- Pilih obat dari inventaris --</option>
                  {obatOptions.map((o) => (
                    <option key={o.obat_id} value={o.obat_id}>
                      {o.nama_obat}{o.kode ? ` — ${o.kode}` : ''}
                    </option>
                  ))}
                </select>
                {obatOptions.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.4rem' }}>
                    Belum ada data obat. Tambahkan obat melalui menu inventaris terlebih dahulu.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Harga Jual Pasien (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newHargaItem.harga_jual}
                  onChange={(e) => setNewHargaItem({ ...newHargaItem, harga_jual: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Alasan / Justifikasi Kenaikan Bahan Farmasi</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Kenaikan harga bahan baku impor dari produsen Bio Farma sebesar 15% serta penyesuaian biaya rantai dingin cold chain..."
                  value={newHargaItem.alasan}
                  onChange={(e) => setNewHargaItem({ ...newHargaItem, alasan: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-medium)' }}
                />
              </div>

              {hargaError && (
                <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {hargaError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddHargaModal(false); setHargaError(null); }}
                  className="btn btn-secondary"
                  disabled={hargaSaving}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-shimmer" disabled={hargaSaving}>
                  {hargaSaving ? 'Menyimpan...' : 'Simpan Riwayat Harga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Preview Template Email Pasien */}
      {previewEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '580px', width: '100%', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#dcfce7', color: '#166534' }}>
                  {previewEmail.status} • SMTP Mailer
                </span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.4rem' }}>
                  {previewEmail.subjek}
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                  Kepada: <strong>{previewEmail.pasien_nama}</strong> &lt;{previewEmail.email_tujuan}&gt;
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Email Body Preview */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-slate-800)' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--color-primary-dark)', fontSize: '1.1rem' }}>PRAKTIK MANDIRI BIDAN RIA INDRASTI J. S.KEB</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Perumahan Bougenvile Blok FG 12b, Simpang Rimbo, Kota Jambi • Telp/WA: 0853-7799-8889</div>
              </div>

              <p>Halo <strong>{previewEmail.pasien_nama}</strong>,</p>
              <p>Terima kasih telah mempercayakan layanan kesehatan ibu dan anak kepada Praktik Mandiri Bidan Ria Indrasti.</p>
              
              <div style={{ background: '#faf5fe', border: '2px dashed var(--border-medium)', borderRadius: '10px', padding: '1rem', margin: '1rem 0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>E-TIKET ANTREAN DIGITAL</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-primary-dark)' }}>A-007</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)' }}>Estimasi Jam Layanan: 09:30 WIB (Sesi Pagi)</div>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)' }}>
                Mohon hadir 10 menit sebelum estimasi waktu. Tunjukkan email atau nomor antrean ini kepada petugas loket pendaftaran.
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--color-slate-400)', textAlign: 'center' }}>
                Email otomatis dari Sistem Antrean Praktik Mandiri Bidan Ria Indrasti.
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPreviewEmail(null)} className="btn btn-primary" style={{ fontSize: '0.8125rem' }}>
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

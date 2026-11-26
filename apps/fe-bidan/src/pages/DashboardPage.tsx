import React, { useState, useEffect } from 'react';
import { apiClient, session } from '../api/client';
import { pesanErrorApi } from '../api/errors';
import { KLINIK_INFO } from '../constants/klinik';
import { AuditLogItem, HargaObatLogItem, NotifikasiEmailPasien } from '../api/types';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ReservationModal } from '../components/ReservationModal';

interface DashboardPageProps {
  onLogout: () => void;
  onGoToHome?: () => void;
  initialRole?: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN';
}

type AdminTab =
  | 'antrean'
  | 'pendaftaran'
  | 'pasien'
  | 'sesi'
  | 'kasir'
  | 'keuangan'
  | 'stok'
  | 'riwayat_harga'
  | 'email';

interface MasterLayananRow {
  layanan_id: string;
  kode: string;
  nama: string;
  kategori: string;
  harga: number;
  jumlah_tindakan: number;
  total_realisasi: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, onGoToHome, initialRole }) => {
  const authenticatedRole =
    initialRole ||
    (localStorage.getItem('bidan_user_role') as 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN') ||
    'ADMIN_LOKAL';
  const isSuperAdmin = authenticatedRole === 'SUPERADMIN';
  const [currentRole, setCurrentRole] = useState<'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN'>(authenticatedRole);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Clean non-blocking toast notification (replaces all window.alert)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const notify = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ type, text });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Navigation sub-tabs
  const [adminTab, setAdminTab] = useState<AdminTab>('antrean');
  const [rmeTab, setRmeTab] = useState<'input' | 'riwayat'>('input');
  const [pasienTab, setPasienTab] = useState<'tiket' | 'lokasi'>('tiket');

  // Superadmin Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [totalAkunPengguna, setTotalAkunPengguna] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditFilter, setAuditFilter] = useState<string>('SEMUA');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);

  // Master Data & Harga
  const [reloadHarga, setReloadHarga] = useState(0);
  const [masterLayananList, setMasterLayananList] = useState<MasterLayananRow[]>([]);
  const [masterObatList, setMasterObatList] = useState<Array<{ obat_id: string; nama_generik: string; harga_jual: number; satuan?: string }>>([]);
  const [hargaLogs, setHargaLogs] = useState<HargaObatLogItem[]>([]);
  const [showAddHargaModal, setShowAddHargaModal] = useState<boolean>(false);
  const [hargaSaving, setHargaSaving] = useState<boolean>(false);
  const [hargaError, setHargaError] = useState<string | null>(null);
  const [obatOptions, setObatOptions] = useState<Array<{ obat_id: string; nama_obat: string; kategori: string; kode: string }>>([]);
  const [newHargaItem, setNewHargaItem] = useState({
    obat_id: '',
    nama_obat: '',
    kategori: '',
    harga_jual: 0,
    alasan: ''
  });

  // Antrean, Pasien, & Sesi
  const [queueList, setQueueList] = useState<any[]>([]);
  const [queueStatusFilter, setQueueStatusFilter] = useState<'SEMUA' | 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI'>('SEMUA');
  const [queueSearch, setQueueSearch] = useState<string>('');
  const [activeQueueNum, setActiveQueueNum] = useState<string>('-');
  const [callAlert, setCallAlert] = useState<string | null>(null);
  const [registeredPatients, setRegisteredPatients] = useState<Array<{
    pasien_id: string;
    no_rm: string;
    nik: string;
    nama: string;
    jenis_kelamin: string;
    tgl_lahir: string;
    no_telepon: string;
    alamat: string;
    email?: string;
  }>>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState<string>('');
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [newSesiForm, setNewSesiForm] = useState({
    tanggal: new Date().toISOString().split('T')[0] || '',
    jam_mulai: '08:00',
    jam_selesai: '12:00',
    kuota_maks: 15,
    durasi_per_pasien: 20
  });
  const [isSavingSesi, setIsSavingSesi] = useState(false);

  // Walk-In Loket State
  const [walkinForm, setWalkinForm] = useState({
    nik: '',
    nama: '',
    tgl_lahir: '',
    tempat_lahir: '',
    alamat: '',
    no_telepon: '',
    layanan_id: ''
  });
  const [walkinSesiId, setWalkinSesiId] = useState<string>('');
  const [walkinEmail, setWalkinEmail] = useState<string>('');
  const [kirimEmailNotif, setKirimEmailNotif] = useState<boolean>(true);
  const [walkinSubmitting, setWalkinSubmitting] = useState<boolean>(false);

  // Kasir & Keuangan State
  const [tagihanList, setTagihanList] = useState<any[]>([]);
  const [tagihanStatusFilter, setTagihanStatusFilter] = useState<'SEMUA' | 'BELUM_LUNAS' | 'LUNAS'>('SEMUA');
  const [tagihanSearch, setTagihanSearch] = useState<string>('');
  const [kasirDrawerTagihan, setKasirDrawerTagihan] = useState<any | null>(null);
  const [kasirDrawerRincian, setKasirDrawerRincian] = useState<any[]>([]);
  const [rekapMetode, setRekapMetode] = useState<any[]>([]);
  const [kasirForm, setKasirForm] = useState({
    tagihan_id: '',
    jumlah: '',
    metode: 'TUNAI' as 'TUNAI' | 'QRIS' | 'TRANSFER' | 'BPJS',
    jenis: 'PELUNASAN' as 'PELUNASAN' | 'CICILAN' | 'UANG_MUKA'
  });
  const [kasirSubmitting, setKasirSubmitting] = useState(false);

  // Optional Manual Adjustment Modal in Kasir
  const [showCreateBillingModal, setShowCreateBillingModal] = useState<boolean>(false);
  const [billingPatientId, setBillingPatientId] = useState<string>('');
  const [billingPatientNama, setBillingPatientNama] = useState<string>('');
  const [billingItems, setBillingItems] = useState<Array<{
    id: string;
    tipe: 'LAYANAN' | 'OBAT';
    ref_id: string;
    nama: string;
    qty: number;
    harga_satuan: number;
    subtotal: number;
  }>>([]);
  const [selectedLayananId, setSelectedLayananId] = useState<string>('');
  const [selectedObatId, setSelectedObatId] = useState<string>('');
  const [selectedObatQty, setSelectedObatQty] = useState<number>(1);
  const [billingSubmitting, setBillingSubmitting] = useState<boolean>(false);

  // Inventaris Obat & Alkes State
  const [stokAlkes, setStokAlkes] = useState<any[]>([]);
  const [showAddAlkesModal, setShowAddAlkesModal] = useState<boolean>(false);
  const [showMutasiStokModal, setShowMutasiStokModal] = useState<boolean>(false);
  const [alkesSaving, setAlkesSaving] = useState<boolean>(false);
  const [mutasiSaving, setMutasiSaving] = useState<boolean>(false);
  const [newAlkesItem, setNewAlkesItem] = useState({
    kode: '',
    nama_generik: '',
    kategori: 'ALKES',
    bentuk: 'Pcs',
    satuan: 'pcs',
    stok_total: 20,
    stok_minimum: 5
  });
  const [mutasiForm, setMutasiForm] = useState({
    obat_id: '',
    jenis: 'MASUK' as 'MASUK' | 'KELUAR',
    jumlah: 10,
    no_batch: '',
    keterangan: ''
  });

  // Notifikasi Email State
  const [emailLogs, setEmailLogs] = useState<NotifikasiEmailPasien[]>([]);
  const [previewEmail, setPreviewEmail] = useState<NotifikasiEmailPasien | null>(null);

  // RME Bidan State (Clean 2-Panel SOAP + Resep Obat Auto-Billing)
  const [rmeSearchNik, setRmeSearchNik] = useState<string>('');
  const [rmeQueueFilter, setRmeQueueFilter] = useState<string>('');
  const [rmeLeftMode, setRmeLeftMode] = useState<'antrean' | 'pasien'>('antrean');
  const [selectedRmePatient, setSelectedRmePatient] = useState<any>(null);
  const [isSavingRme, setIsSavingRme] = useState<boolean>(false);
  const [rmeLayananId, setRmeLayananId] = useState<string>('');
  const [rmePickObatId, setRmePickObatId] = useState<string>('');
  const [rmePickObatQty, setRmePickObatQty] = useState<number>(1);
  const [rmeObatItems, setRmeObatItems] = useState<Array<{
    obat_id: string;
    nama: string;
    qty: number;
    harga_satuan: number;
  }>>([]);
  const [rmeForm, setRmeForm] = useState({
    tekanan_darah_sistolik: '',
    tekanan_darah_diastolik: '',
    tinggi_fundus: '',
    djj: '',
    berat_badan: '',
    usia_kehamilan: '',
    presentasi: '',
    keluhan: '',
    pemeriksaan_fisik: '',
    diagnosa: '',
    kode_icd10: '',
    tindakan_resep: '',
    protokol_tambahan: '',
    catatan_edukasi: '',
    tgl_kontrol_ulang: ''
  });
  const [rmeSearchTerm, setRmeSearchTerm] = useState<string>('');
  const [rmeCurrentPage, setRmeCurrentPage] = useState<number>(1);
  const [rmeSavedList, setRmeSavedList] = useState<Array<{
    id: string;
    waktu: string;
    pasien_nama: string;
    nik: string;
    no_rm: string;
    diagnosa: string;
    tindakan: string;
    tekanan_darah: string;
    djj: string;
  }>>([]);

  // Pasien Portal State
  const [showPatientReservationModal, setShowPatientReservationModal] = useState<boolean>(false);

  // Fetch helpers
  const mapReservasiRows = (rows: any[]) =>
    rows.map((r: any, idx: number) => {
      const jMulai = r.jam_mulai ? String(r.jam_mulai).slice(0, 5) : '08:00';
      const jSelesai = r.jam_selesai ? String(r.jam_selesai).slice(0, 5) : '12:00';
      return {
        reservasi_id: String(r.reservasi_id || ''),
        pasien_id: String(r.pasien_id || ''),
        layanan_id: String(r.layanan_id || ''),
        nik: String(r.nik_pasien || r.nik || ''),
        tanggal: r.tanggal ? String(r.tanggal).split('T')[0] : '',
        no: r.nomor_antrean ? `A-${String(r.nomor_antrean).padStart(3, '0')}` : `A-${String(idx + 1).padStart(3, '0')}`,
        nama: String(r.nama_pasien || 'Pasien'),
        layanan: String(r.nama_layanan || 'Pemeriksaan Kebidanan').replace(/Dokter\s+Umum/gi, 'Pemeriksaan Umum'),
        sesi: `${jMulai} - ${jSelesai} WIB`,
        jam: r.estimasi_jam ? `${String(r.estimasi_jam).slice(0, 5)} WIB` : `${jMulai} - ${jSelesai} WIB`,
        status: r.status === 'SELESAI' ? 'SELESAI' : r.status === 'DIPANGGIL' ? 'DIPANGGIL' : 'MENUNGGU'
      };
    });

  const refreshReservasi = () => {
    apiClient
      .post('/reservasi/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped = mapReservasiRows(res.data.data);
          setQueueList(mapped);
          const active = mapped.find((q: any) => q.status === 'DIPANGGIL') || mapped.find((q: any) => q.status === 'MENUNGGU');
          setActiveQueueNum(active ? active.no : '-');
        }
      })
      .catch(() => {});
  };

  const refreshHargaDanLayanan = () => {
    apiClient
      .post('/harga/list', {})
      .then((res) => {
        const rawObat = res.data?.data?.obat;
        if (Array.isArray(rawObat)) {
          const onlyWithHarga = rawObat.filter((item: any) => item.harga_obat_id);
          const mappedLogs: HargaObatLogItem[] = onlyWithHarga.map((item: any) => {
            const jual = Number(item.harga_jual || item.harga || 0);
            const beli = Number(item.hpp_beli || item.harga_beli || 0);
            const marginRp = beli > 0 ? jual - beli : 0;
            const marginPersen = beli > 0 ? Math.round((marginRp / beli) * 100) : 0;
            return {
              harga_obat_id: String(item.harga_obat_id ?? ''),
              obat_id: String(item.obat_id ?? ''),
              kode_obat: String(item.kode ?? item.kode_obat ?? ''),
              nama_obat: String(item.nama_dagang || item.nama_generik || item.nama || 'Obat'),
              kategori: String(item.kategori || 'Farmasi'),
              hpp_beli: beli,
              harga_jual: jual,
              margin_rp: marginRp,
              margin_persen: marginPersen,
              berlaku_dari: item.berlaku_dari ? new Date(item.berlaku_dari).toLocaleDateString('id-ID') : '-',
              berlaku_sampai: item.berlaku_sampai ? new Date(item.berlaku_sampai).toLocaleDateString('id-ID') : null,
              diubah_oleh: String(item.diubah_oleh || 'Staf Farmasi'),
              alasan: String(item.alasan || '-')
            };
          });
          setHargaLogs(mappedLogs);
          setMasterObatList(
            rawObat.map((o: any) => ({
              obat_id: String(o.obat_id || ''),
              nama_generik: String(o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : o.nama_generik || o.nama || 'Obat'),
              harga_jual: Number(o.harga_jual || o.harga || 0),
              satuan: String(o.satuan || 'pcs')
            }))
          );
        }

        const rawLayanan = res.data?.data?.layanan;
        if (Array.isArray(rawLayanan) && rawLayanan.length > 0) {
          const mappedLayanan: MasterLayananRow[] = rawLayanan.map((l: any) => ({
            layanan_id: String(l.layanan_id || ''),
            kode: String(l.kode || '-'),
            nama: String(l.nama || 'Layanan Medis').replace(/Dokter\s+Umum/gi, 'Pemeriksaan Umum'),
            kategori: String(l.kategori || 'Kebidanan'),
            harga: Number(l.harga || 0),
            jumlah_tindakan: Number(l.jumlah_tindakan || 0),
            total_realisasi: Number(l.total_realisasi || 0)
          }));
          setMasterLayananList(mappedLayanan);
          setWalkinForm((prev) => (prev.layanan_id ? prev : { ...prev, layanan_id: mappedLayanan[0]?.layanan_id || '' }));
          setRmeLayananId((prev) => prev || mappedLayanan[0]?.layanan_id || '');
        }
      })
      .catch(() => {});
  };

  const refreshKeuanganDanTagihan = () => {
    apiClient
      .post('/tagihan/list', { limit: 100 })
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setTagihanList(res.data.data);
        }
      })
      .catch(() => {});

    apiClient
      .post('/keuangan/rekap/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setRekapMetode(res.data.data);
        }
      })
      .catch(() => {});

    refreshHargaDanLayanan();
  };

  useEffect(() => {
    refreshHargaDanLayanan();

    apiClient
      .post('/public/layanan/list', {})
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setMasterLayananList((prev) => {
            if (prev.length > 0) return prev;
            const list: MasterLayananRow[] = res.data.data.map((l: any) => ({
              layanan_id: String(l.layanan_id || ''),
              kode: String(l.kode || '-'),
              nama: String(l.nama || 'Layanan Kebidanan').replace(/Dokter\s+Umum/gi, 'Pemeriksaan Umum'),
              kategori: String(l.kategori || 'Kebidanan'),
              harga: Number(l.harga || 0),
              jumlah_tindakan: 0,
              total_realisasi: 0
            }));
            setWalkinForm((wf) => (wf.layanan_id ? wf : { ...wf, layanan_id: list[0]?.layanan_id || '' }));
            setRmeLayananId((cur) => cur || list[0]?.layanan_id || '');
            return list;
          });
        }
      })
      .catch(() => {});

    apiClient
      .post('/keuangan/rekap/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setRekapMetode(res.data.data);
        }
      })
      .catch(() => {});

    apiClient
      .post('/tagihan/list', { limit: 100 })
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setTagihanList(res.data.data);
        }
      })
      .catch(() => {});

    apiClient
      .post('/public/sesi/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setSesiList(res.data.data);
          if (res.data.data[0]?.jadwal_id) {
            setWalkinSesiId((prev) => prev || String(res.data.data[0].jadwal_id));
          }
        }
      })
      .catch(() => {});

    apiClient
      .post('/audit-logs/list', { limit: 10000 })
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped: AuditLogItem[] = res.data.data.map((a: any, idx: number) => ({
            log_id: Number(a.log_id || idx + 1),
            waktu: a.waktu ? new Date(a.waktu).toLocaleString('id-ID') : '-',
            user_ref: String(a.user_ref || a.akun_id || 'Sistem'),
            peran: String(a.peran || 'STAF'),
            aksi: String(a.aksi || 'UPDATE'),
            tabel: String(a.tabel || '-'),
            id_baris: String(a.id_baris || '-'),
            ip_address: String(a.ip_address || '-'),
            nilai_lama: String(a.keterangan || '-'),
            nilai_baru: String(a.keterangan || '-')
          }));
          setAuditLogs(mapped);
          if (res.data?.meta && typeof res.data.meta.total_pengguna === 'number') {
            setTotalAkunPengguna(res.data.meta.total_pengguna);
          } else {
            const uniqueUsers = new Set(mapped.map((l) => l.user_ref).filter(Boolean)).size;
            setTotalAkunPengguna(uniqueUsers);
          }
        }
      })
      .catch(() => setAuditLogs([]));

    refreshReservasi();

    apiClient
      .post('/klinis/rme/list', { limit: 100 })
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setRmeSavedList(
            res.data.data.map((item: any) => ({
              id: String(item.no_dokumen || item.id || `RME-${item.pemeriksaan_id || '001'}`),
              waktu: item.waktu ? new Date(item.waktu).toLocaleString('id-ID') : '-',
              pasien_nama: String(item.pasien_nama || 'Pasien'),
              nik: String(item.nik || '-'),
              no_rm: String(item.no_rm || '-'),
              diagnosa: String(item.diagnosa || item.asesmen || '-'),
              tindakan: String(item.tindakan || item.rencana || '-'),
              tekanan_darah: String(item.tekanan_darah || '-'),
              djj: String(item.djj || '-')
            }))
          );
        }
      })
      .catch(() => {});

    apiClient
      .post('/inventaris/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map((o: any) => ({
            obat_id: o.obat_id,
            kode: o.kode || o.obat_id,
            nama: o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : o.nama_generik || 'Obat',
            kategori: o.kategori || 'Farmasi',
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
                nama_obat: o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : String(o.nama_generik || 'Obat'),
                kategori: String(o.kategori || 'Farmasi'),
                kode: String(o.kode || '')
              }))
          );
        }
      })
      .catch(() => {});

    apiClient
      .post('/pasien/identitas/list', { limit: 100 })
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setRegisteredPatients(res.data.data);
        }
      })
      .catch(() => {});

    apiClient
      .post('/notifikasi/log/list', {})
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const mapped: NotifikasiEmailPasien[] = res.data.data.map((n: any) => ({
            notif_id: String(n.notif_id || n.id),
            pasien_nama: String(n.tujuan_nama || n.pasien_nama || 'Pasien'),
            email_tujuan: String(n.tujuan || n.email || '-'),
            jenis: n.jenis || 'TIKET_RESERVASI',
            subjek: String(n.subjek || 'Notifikasi Layanan'),
            waktu_kirim: n.waktu_kirim ? new Date(n.waktu_kirim).toLocaleString('id-ID') : 'Terkirim',
            status: n.status === 'GAGAL' ? 'GAGAL' : n.status === 'ANTRE' ? 'MENUNGGU' : 'TERKIRIM'
          }));
          setEmailLogs(mapped);
        }
      })
      .catch(() => {});
  }, [reloadHarga]);

  // Select patient for RME and prefill chosen service from active reservation
  const selectPatientForRme = (patient: any, switchView = false) => {
    setSelectedRmePatient(patient);
    setRmeSearchNik(patient?.nik || '');
    const matchingReservation = queueList.find(
      (q) =>
        (patient?.pasien_id && q.pasien_id === patient.pasien_id) ||
        (patient?.nik && q.nik === patient.nik)
    );
    if (patient?.layanan_id) {
      setRmeLayananId(patient.layanan_id);
    } else if (matchingReservation?.layanan_id) {
      setRmeLayananId(matchingReservation.layanan_id);
    }
    if (switchView) {
      if (isSuperAdmin) {
        setCurrentRole('DOKTER');
        setRmeTab('input');
      }
      notify(`Pasien ${patient?.nama || ''} dipilih untuk pemeriksaan RME.`, 'info');
    }
  };

  // Auto-pilih pasien antrean aktif pertama saat Bidan membuka RME jika belum ada pasien terpilih
  useEffect(() => {
    if (selectedRmePatient || queueList.length === 0) return;
    const priorityQueue =
      queueList.find((q) => q.status === 'DIPANGGIL') ||
      queueList.find((q) => q.status === 'MENUNGGU');
    if (priorityQueue && priorityQueue.pasien_id) {
      const regMatch = registeredPatients.find((p) => p.pasien_id === priorityQueue.pasien_id);
      setSelectedRmePatient({
        pasien_id: priorityQueue.pasien_id,
        nama: priorityQueue.nama,
        nik: priorityQueue.nik || regMatch?.nik || '-',
        no_rm: regMatch?.no_rm || '-',
        alamat: regMatch?.alamat || 'Kota Jambi'
      });
      if (priorityQueue.layanan_id) {
        setRmeLayananId(priorityQueue.layanan_id);
      }
    }
  }, [queueList, registeredPatients, selectedRmePatient]);

  // Human-readable audit description
  const formatAktivitasManusia = (aksi: string, tabel: string, _user_ref?: string, keterangan?: string): string => {
    const t = (tabel || '').toLowerCase();
    const a = (aksi || '').toUpperCase();
    if (t.includes('pasien')) {
      if (a.includes('INSERT') || a.includes('CREATE')) return 'Mendaftarkan pasien baru';
      if (a.includes('UPDATE')) return 'Memperbarui data identitas pasien';
      if (a.includes('DELETE')) return 'Menghapus data pasien';
    }
    if (t.includes('reservasi') || t.includes('antrean')) {
      if (a.includes('INSERT') || a.includes('CREATE')) return 'Membuat reservasi antrean kunjungan';
      if (a.includes('UPDATE')) return 'Memperbarui status antrean pasien';
      if (a.includes('BATAL')) return 'Membatalkan antrean pasien';
    }
    if (t.includes('jadwal') || t.includes('sesi')) {
      if (a.includes('INSERT')) return 'Menambahkan jadwal sesi praktik';
      if (a.includes('UPDATE')) return 'Memperbarui kuota atau jam sesi';
    }
    if (t.includes('pembayaran') || t.includes('tagihan')) {
      if (a.includes('INSERT') || a.includes('BAYAR')) return 'Mencatat pembayaran kasir';
      if (a.includes('UPDATE')) return 'Memperbarui status tagihan pasien';
    }
    if (t.includes('rekam_medis') || t.includes('rme') || t.includes('cppt') || t.includes('pemeriksaan')) {
      return 'Menyimpan catatan pemeriksaan RME';
    }
    if (t.includes('obat') || t.includes('alkes') || t.includes('stok') || t.includes('mutasi')) {
      if (a.includes('HARGA')) return 'Menyesuaikan tarif obat atau layanan';
      return 'Mencatat perubahan stok inventaris';
    }
    if (t.includes('notifikasi') || t.includes('email')) {
      return 'Mengirimkan email notifikasi pasien';
    }
    if (a.includes('LOGIN') || a.includes('AUTH')) {
      return 'Masuk ke dalam sistem portal';
    }
    if (keterangan && keterangan !== '-' && keterangan.length > 5) {
      return keterangan;
    }
    return `Aktivitas ${a} pada ${tabel.replace(/[dbo.[\]_]/g, ' ').trim()}`;
  };

  const handleDownloadCsv = () => {
    const headers = ['Log ID', 'Waktu Aktivitas', 'Pengguna', 'Peran', 'Keterangan Aktivitas', 'Aksi', 'Target', 'ID Baris', 'Alamat IP'];
    const rows = auditLogs.map((log) => [
      log.log_id,
      `"${log.waktu}"`,
      `"${log.user_ref}"`,
      `"${log.peran === 'DOKTER' ? 'BIDAN' : log.peran}"`,
      `"${formatAktivitasManusia(log.aksi, log.tabel, log.user_ref, log.nilai_lama)}"`,
      `"${log.aksi}"`,
      `"${log.tabel}"`,
      `"${log.id_baris}"`,
      `"${log.ip_address}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_log_bidan_ria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadConfirm(false);
    notify('File CSV log audit berhasil diunduh.', 'success');
  };

  // Queue handlers
  const handleCallQueue = (nomor: string, nama: string, reservasi_id?: string) => {
    setActiveQueueNum(nomor);
    setCallAlert(`Memanggil antrean ${nomor} (${nama}) ke Ruang Periksa.`);
    setQueueList((prev) =>
      prev.map((q) => ((reservasi_id && q.reservasi_id === reservasi_id) || q.no === nomor ? { ...q, status: 'DIPANGGIL' } : q))
    );
    if (reservasi_id) {
      apiClient.patch(`/reservasi/${reservasi_id}/status`, { status: 'DIPANGGIL' }).catch(() => {});
    }
    setTimeout(() => setCallAlert(null), 4000);
  };

  const handleFinishQueue = async (nomor: string, reservasi_id?: string) => {
    setQueueList((prev) =>
      prev.map((q) => ((reservasi_id && q.reservasi_id === reservasi_id) || q.no === nomor ? { ...q, status: 'SELESAI' } : q))
    );
    if (reservasi_id) {
      try {
        await apiClient.patch(`/reservasi/${reservasi_id}/status`, { status: 'SELESAI' });
        refreshKeuanganDanTagihan();
        notify(`Kunjungan antrean ${nomor} selesai. Tagihan otomatis tersedia di menu Kasir.`, 'success');
      } catch {
        notify('Gagal memperbarui status antrean.', 'error');
      }
    }
  };

  // Sesi handlers
  const handleCreateSesi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSesi(true);
    try {
      let stafId = sesiList[0]?.staf_id;
      let unitId = sesiList[0]?.unit_id;
      let ruanganId = sesiList[0]?.ruangan_id;

      if (!stafId || !unitId || !ruanganId) {
        const sesiRes = await apiClient.post('/public/sesi/list', { limit: 10 });
        if (sesiRes.data?.data && sesiRes.data.data.length > 0) {
          const first = sesiRes.data.data[0];
          stafId = stafId || first.staf_id;
          unitId = unitId || first.unit_id;
          ruanganId = ruanganId || first.ruangan_id;
        }
      }
      if (!unitId) {
        const unitRes = await apiClient.post('/public/layanan/list', {});
        unitId = unitRes.data?.data?.[0]?.unit_id;
      }

      await apiClient.post('/sesi', {
        tanggal: newSesiForm.tanggal,
        jam_mulai: newSesiForm.jam_mulai,
        jam_selesai: newSesiForm.jam_selesai,
        kuota_maks: Number(newSesiForm.kuota_maks),
        durasi_per_pasien: Number(newSesiForm.durasi_per_pasien),
        staf_id: stafId,
        unit_id: unitId,
        ruangan_id: ruanganId
      });
      notify(`Jadwal sesi ${newSesiForm.tanggal} (${newSesiForm.jam_mulai} - ${newSesiForm.jam_selesai}) berhasil ditambahkan.`, 'success');
      const updated = await apiClient.post('/public/sesi/list', {});
      if (updated.data?.data) setSesiList(updated.data.data);
    } catch (err) {
      notify(pesanErrorApi(err, 'Gagal menyimpan sesi praktik baru.'), 'error');
    } finally {
      setIsSavingSesi(false);
    }
  };

  const handleUpdateSesiKuota = async (jadwalId: string, newKuota: number) => {
    if (!jadwalId) return;
    try {
      await apiClient.patch(`/sesi/${jadwalId}`, { kuota_maks: newKuota });
      notify(`Kuota sesi diperbarui menjadi ${newKuota} pasien.`, 'success');
      const updated = await apiClient.post('/public/sesi/list', {});
      if (updated.data?.data) setSesiList(updated.data.data);
    } catch (err) {
      notify(pesanErrorApi(err, 'Gagal memperbarui kuota sesi.'), 'error');
    }
  };

  // Kasir Slide-Over Drawer & Payment Handlers
  const openKasirDrawer = (tagihan: any) => {
    const tot = Number(tagihan.total_tagihan !== undefined ? tagihan.total_tagihan : tagihan.total || 0);
    const dibayar = Number(tagihan.total_dibayar !== undefined ? tagihan.total_dibayar : tagihan.terbayar || 0);
    const sisaNominal = Math.max(0, Number(tagihan.sisa !== undefined ? tagihan.sisa : tot - dibayar));
    setKasirDrawerTagihan(tagihan);
    setKasirDrawerRincian([]);
    setKasirForm({
      tagihan_id: tagihan.tagihan_id,
      jumlah: String(sisaNominal > 0 ? sisaNominal : tot),
      metode: 'TUNAI',
      jenis: 'PELUNASAN'
    });
    if (tagihan.kunjungan_id) {
      apiClient
        .post(`/kunjungan/${tagihan.kunjungan_id}/tagihan/detail`, {})
        .then((res) => {
          if (Array.isArray(res.data?.data?.rincian)) {
            setKasirDrawerRincian(res.data.data.rincian);
          }
        })
        .catch(() => {});
    }
  };

  const closeKasirDrawer = () => {
    setKasirDrawerTagihan(null);
    setKasirDrawerRincian([]);
  };

  const handleKasirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasirForm.tagihan_id) {
      notify('Pilih tagihan pasien yang akan dibayar terlebih dahulu.', 'error');
      return;
    }
    const jlh = Number(kasirForm.jumlah);
    if (!jlh || jlh <= 0) {
      notify('Nominal pembayaran harus lebih dari Rp 0.', 'error');
      return;
    }
    setKasirSubmitting(true);
    try {
      await apiClient.post(`/tagihan/${kasirForm.tagihan_id}/pembayaran`, {
        jumlah: jlh,
        metode: kasirForm.metode,
        jenis: kasirForm.jenis,
        kasir_staf_id: sesiList[0]?.staf_id
      });
      notify(`Pembayaran Rp ${jlh.toLocaleString('id-ID')} (${kasirForm.metode}) berhasil dikonfirmasi.`, 'success');
      setKasirForm({ tagihan_id: '', jumlah: '', metode: 'TUNAI', jenis: 'PELUNASAN' });
      closeKasirDrawer();
      refreshKeuanganDanTagihan();
    } catch (err) {
      notify(pesanErrorApi(err, 'Gagal mencatat pembayaran kasir.'), 'error');
    } finally {
      setKasirSubmitting(false);
    }
  };

  // Optional Manual Adjustment Modal Handlers
  const handleOpenCreateBilling = (patientId?: string, patientNama?: string) => {
    setBillingPatientId(patientId || '');
    setBillingPatientNama(patientNama || '');
    setBillingItems([]);
    setSelectedLayananId('');
    setSelectedObatId('');
    setSelectedObatQty(1);
    setShowCreateBillingModal(true);
  };

  const handleAddLayananItem = () => {
    if (!selectedLayananId) return;
    const item = masterLayananList.find((l) => l.layanan_id === selectedLayananId);
    if (!item) return;
    setBillingItems((prev) => [
      ...prev,
      {
        id: `lay-${Date.now()}-${Math.random()}`,
        tipe: 'LAYANAN',
        ref_id: item.layanan_id,
        nama: item.nama,
        qty: 1,
        harga_satuan: item.harga,
        subtotal: item.harga
      }
    ]);
    setSelectedLayananId('');
  };

  const handleAddObatItem = () => {
    if (!selectedObatId) return;
    const item = masterObatList.find((o) => o.obat_id === selectedObatId);
    if (!item) return;
    const qty = Math.max(1, Number(selectedObatQty) || 1);
    setBillingItems((prev) => [
      ...prev,
      {
        id: `obt-${Date.now()}-${Math.random()}`,
        tipe: 'OBAT',
        ref_id: item.obat_id,
        nama: item.nama_generik,
        qty,
        harga_satuan: item.harga_jual,
        subtotal: item.harga_jual * qty
      }
    ]);
    setSelectedObatId('');
    setSelectedObatQty(1);
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingPatientId) {
      notify('Pilih pasien terlebih dahulu.', 'error');
      return;
    }
    if (billingItems.length === 0) {
      notify('Tambahkan minimal 1 layanan atau obat.', 'error');
      return;
    }
    setBillingSubmitting(true);
    try {
      const rincian = billingItems.map((it) => ({
        layanan_id: it.tipe === 'LAYANAN' ? it.ref_id : null,
        obat_id: it.tipe === 'OBAT' ? it.ref_id : null,
        qty: it.qty,
        harga_satuan: it.harga_satuan,
        subtotal: it.subtotal
      }));
      await apiClient.post(`/kunjungan/${billingPatientId}/tagihan/detail`, { rincian });
      refreshKeuanganDanTagihan();
      notify(`Rincian tagihan untuk ${billingPatientNama || 'pasien'} berhasil diperbarui.`, 'success');
      setShowCreateBillingModal(false);
      setBillingItems([]);
    } catch (err) {
      notify(pesanErrorApi(err, 'Gagal menyimpan rincian tagihan.'), 'error');
    } finally {
      setBillingSubmitting(false);
    }
  };

  // RME Prescription Medicine helpers
  const handleAddRmeObat = () => {
    if (!rmePickObatId) return;
    const found = masterObatList.find((o) => o.obat_id === rmePickObatId);
    if (!found) return;
    const qty = Math.max(1, Number(rmePickObatQty) || 1);
    setRmeObatItems((prev) => {
      const existingIdx = prev.findIndex((x) => x.obat_id === found.obat_id);
      if (existingIdx >= 0) {
        return prev.map((x, i) => (i === existingIdx ? { ...x, qty: x.qty + qty } : x));
      }
      return [
        ...prev,
        {
          obat_id: found.obat_id,
          nama: found.nama_generik,
          qty,
          harga_satuan: found.harga_jual
        }
      ];
    });
    setRmePickObatId('');
    setRmePickObatQty(1);
  };

  const handleSaveRme = async () => {
    if (!selectedRmePatient) {
      notify('Pilih pasien terlebih dahulu sebelum menyimpan pemeriksaan.', 'error');
      return;
    }
    const sistolik = Number(rmeForm.tekanan_darah_sistolik);
    const diastolik = Number(rmeForm.tekanan_darah_diastolik);
    if (!sistolik || sistolik < 50 || sistolik > 260) {
      notify('Tekanan darah Sistolik wajib diisi (50 - 260 mmHg).', 'error');
      return;
    }
    if (!diastolik || diastolik < 30 || diastolik > 160) {
      notify('Tekanan darah Diastolik wajib diisi (30 - 160 mmHg).', 'error');
      return;
    }
    if (!rmeForm.keluhan || rmeForm.keluhan.trim().length < 3) {
      notify('Keluhan pasien (Subjektif) wajib diisi.', 'error');
      return;
    }
    if (!rmeForm.diagnosa || rmeForm.diagnosa.trim().length < 3) {
      notify('Diagnosa (Asesmen) wajib diisi.', 'error');
      return;
    }

    const obatSummaryText = rmeObatItems.map((o) => `${o.nama} (${o.qty}x)`).join(', ');
    const combinedPlan = [rmeForm.tindakan_resep.trim(), obatSummaryText ? `Resep: ${obatSummaryText}` : '']
      .filter(Boolean)
      .join(' | ');

    if (!combinedPlan) {
      notify('Isi rencana tindakan atau tambahkan resep obat pasien.', 'error');
      return;
    }

    setIsSavingRme(true);
    const pasienNama = selectedRmePatient?.nama || 'Pasien';
    const pasienNik = selectedRmePatient?.nik || rmeSearchNik || '-';
    const pasienRm = selectedRmePatient?.no_rm || '-';

    try {
      await apiClient.post('/klinis/rme/simpan', {
        pasien_id: selectedRmePatient.pasien_id,
        layanan_id: rmeLayananId || undefined,
        keluhan: rmeForm.keluhan.trim(),
        pemeriksaan_fisik: rmeForm.pemeriksaan_fisik.trim() || 'Kondisi umum baik',
        asesmen: rmeForm.diagnosa.trim(),
        rencana: combinedPlan,
        diagnosa: rmeForm.diagnosa.trim(),
        tindakan_resep: combinedPlan,
        protokol_tambahan: rmeForm.protokol_tambahan || undefined,
        sistolik,
        diastolik,
        tinggi_fundus: rmeForm.tinggi_fundus ? Number(rmeForm.tinggi_fundus) : undefined,
        djj: rmeForm.djj ? Number(rmeForm.djj) : undefined,
        berat_badan: rmeForm.berat_badan ? Number(rmeForm.berat_badan) : undefined,
        usia_kehamilan: rmeForm.usia_kehamilan || undefined,
        kode_icd10: rmeForm.kode_icd10 || undefined,
        catatan_edukasi: rmeForm.catatan_edukasi || undefined,
        tgl_kontrol_ulang: rmeForm.tgl_kontrol_ulang || undefined,
        resep_obat: rmeObatItems.map((item) => ({
          obat_id: item.obat_id,
          qty: item.qty,
          harga_satuan: item.harga_satuan
        }))
      });

      const rmeRes = await apiClient.post('/klinis/rme/list', { limit: 100 });
      if (rmeRes.data?.data && Array.isArray(rmeRes.data.data)) {
        setRmeSavedList(
          rmeRes.data.data.map((item: any) => ({
            id: String(item.no_dokumen || item.id || `RME-${item.pemeriksaan_id || '001'}`),
            waktu: item.waktu ? new Date(item.waktu).toLocaleString('id-ID') : new Date().toLocaleString('id-ID'),
            pasien_nama: String(item.pasien_nama || pasienNama),
            nik: String(item.nik || pasienNik),
            no_rm: String(item.no_rm || pasienRm),
            diagnosa: String(item.diagnosa || item.asesmen || rmeForm.diagnosa),
            tindakan: String(item.tindakan || item.rencana || combinedPlan),
            tekanan_darah: String(item.tekanan_darah || `${sistolik}/${diastolik} mmHg`),
            djj: item.djj ? String(item.djj) : rmeForm.djj ? `${rmeForm.djj} dpm` : '-'
          }))
        );
      }

      refreshReservasi();
      refreshKeuanganDanTagihan();

      notify(`Pemeriksaan ${pasienNama} tersimpan & tagihan otomatis diterbitkan ke Kasir.`, 'success');
      setRmeObatItems([]);
      setRmeForm({
        tekanan_darah_sistolik: '',
        tekanan_darah_diastolik: '',
        tinggi_fundus: '',
        djj: '',
        berat_badan: '',
        usia_kehamilan: '',
        presentasi: '',
        keluhan: '',
        pemeriksaan_fisik: '',
        diagnosa: '',
        kode_icd10: '',
        tindakan_resep: '',
        protokol_tambahan: '',
        catatan_edukasi: '',
        tgl_kontrol_ulang: ''
      });
    } catch (err) {
      notify(pesanErrorApi(err, 'Gagal menyimpan pemeriksaan RME.'), 'error');
    } finally {
      setIsSavingRme(false);
    }
  };

  // Computed Data
  const filteredAuditLogs = auditLogs.filter((log) => {
    let matchFilter = true;
    if (auditFilter === 'LOGIN') {
      matchFilter = log.aksi === 'LOGIN' || log.aksi.toLowerCase().includes('login');
    } else if (auditFilter === 'UPDATE') {
      matchFilter = log.aksi === 'UPDATE' && !log.aksi.toLowerCase().includes('login');
    } else if (auditFilter !== 'SEMUA') {
      matchFilter = log.aksi.includes(auditFilter) || log.tabel.includes(auditFilter);
    }
    const matchSearch =
      auditSearch === '' ||
      log.user_ref.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.aksi.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.id_baris.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.ip_address.includes(auditSearch);
    return matchFilter && matchSearch;
  });

  const auditPerPage = 20;
  const totalAuditPages = Math.ceil(filteredAuditLogs.length / auditPerPage) || 1;
  const paginatedAuditLogs = filteredAuditLogs.slice((auditPage - 1) * auditPerPage, auditPage * auditPerPage);

  const unpaidCount = tagihanList.filter((t) => t.status !== 'LUNAS').length;
  const totalInflowKasir = rekapMetode.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const totalTransaksiKasir = rekapMetode.reduce((acc, item) => acc + (Number(item.jumlah_transaksi) || 0), 0);
  const totalNilaiTagihan = tagihanList.reduce(
    (acc, t) => acc + Number(t.total_tagihan !== undefined ? t.total_tagihan : t.total || 0),
    0
  );
  const totalPiutangBelumLunas = tagihanList
    .filter((t) => t.status !== 'LUNAS')
    .reduce((acc, t) => {
      const tot = Number(t.total_tagihan !== undefined ? t.total_tagihan : t.total || 0);
      const dibayar = Number(t.total_dibayar !== undefined ? t.total_dibayar : t.terbayar || 0);
      const sisa = Number(t.sisa !== undefined ? t.sisa : tot - dibayar);
      return acc + Math.max(0, sisa);
    }, 0);

  const filteredTagihanList = tagihanList.filter((t) => {
    if (tagihanStatusFilter === 'BELUM_LUNAS' && t.status === 'LUNAS') return false;
    if (tagihanStatusFilter === 'LUNAS' && t.status !== 'LUNAS') return false;
    if (tagihanSearch.trim()) {
      const q = tagihanSearch.toLowerCase().trim();
      const noTag = String(t.no_tagihan || `INV-${String(t.tagihan_id).slice(0, 6)}`).toLowerCase();
      const nama = String(t.nama_pasien || '').toLowerCase();
      const rincian = String(t.rincian_item || '').toLowerCase();
      return noTag.includes(q) || nama.includes(q) || rincian.includes(q);
    }
    return true;
  });

  const filteredQueueList = queueList.filter((q) => {
    if (queueStatusFilter !== 'SEMUA' && q.status !== queueStatusFilter) return false;
    if (queueSearch.trim()) {
      const s = queueSearch.toLowerCase().trim();
      return (
        String(q.no || '').toLowerCase().includes(s) ||
        String(q.nama || '').toLowerCase().includes(s) ||
        String(q.layanan || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const activeUserName =
    localStorage.getItem('bidan_user_nama') ||
    localStorage.getItem('bidan_pasien_nama') ||
    localStorage.getItem('bidan_user_identifier') ||
    'Pengguna';

  const roleDisplayLabel =
    currentRole === 'SUPERADMIN'
      ? 'Superadmin'
      : currentRole === 'ADMIN_LOKAL'
      ? 'Staf Administrasi'
      : currentRole === 'DOKTER'
      ? 'Bidan Praktik'
      : 'Pasien';

  const activeSectionTitle = (() => {
    if (currentRole === 'SUPERADMIN') return 'Log Audit Sistem';
    if (currentRole === 'DOKTER') return rmeTab === 'input' ? 'Pemeriksaan RME (SOAP)' : 'Riwayat RME Pasien';
    if (currentRole === 'PASIEN') return pasienTab === 'tiket' ? 'Antrean & Reservasi Saya' : 'Lokasi & Kontak Klinik';
    const map: Record<AdminTab, string> = {
      antrean: 'Antrean Hari Ini',
      pendaftaran: 'Pendaftaran Loket (Walk-In)',
      pasien: 'Data Pasien Terdaftar',
      sesi: 'Jadwal Sesi & Kuota',
      kasir: 'Kasir & Status Tagihan',
      keuangan: 'Rekapitulasi Keuangan',
      stok: 'Inventaris Obat & Alkes',
      riwayat_harga: 'Riwayat Harga Obat',
      email: 'Notifikasi Email Pasien'
    };
    return map[adminTab];
  })();

  const selectAdminMenu = (tab: AdminTab) => {
    setAdminTab(tab);
    if (tab === 'kasir' || tab === 'keuangan') {
      refreshKeuanganDanTagihan();
    } else if (tab === 'antrean') {
      refreshReservasi();
    }
    setSidebarOpen(false);
  };

  return (
    <div className="dash-shell">
      {/* Global Non-Blocking Toast */}
      {toast && (
        <div
          className="dash-toast"
          style={{
            background: toast.type === 'success' ? '#ecfdf5' : toast.type === 'error' ? '#fef2f2' : '#f8fafc',
            color: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#991b1b' : '#1e293b',
            border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : toast.type === 'error' ? '#fecaca' : '#cbd5e1'}`
          }}
        >
          <span style={{ lineHeight: 1.45 }}>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ color: 'inherit', opacity: 0.7, fontWeight: 700, fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem' }}
            aria-label="Tutup notifikasi"
          >
            &times;
          </button>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      <div
        className={`dash-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Left Sidebar (Fixed on Desktop, Slide-over Drawer on Mobile) */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="dash-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            <img
              src="/logo-bidan.png"
              alt="Logo PMB"
              style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('public/logo-bidan.png')) target.src = './public/logo-bidan.png';
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                PMB Ria Indrasti
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roleDisplayLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="dash-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dash-sidebar-body">
          {/* Superadmin Mode Switcher */}
          {isSuperAdmin && (
            <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.3rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.2rem' }}>
              {[
                { key: 'SUPERADMIN', label: 'Audit' },
                { key: 'ADMIN_LOKAL', label: 'Admin' },
                { key: 'DOKTER', label: 'Bidan' }
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setCurrentRole(m.key as any)}
                  style={{
                    padding: '0.35rem 0.25rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    background: currentRole === m.key ? 'var(--color-primary)' : 'transparent',
                    color: currentRole === m.key ? '#ffffff' : '#64748b'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* MENU: ADMIN OPERASIONAL */}
          {currentRole === 'ADMIN_LOKAL' && (
            <>
              <div className="dash-nav-section">
                <div className="dash-nav-label">Pelayanan &amp; Loket</div>
                <button type="button" className={`dash-nav-item ${adminTab === 'antrean' ? 'active' : ''}`} onClick={() => selectAdminMenu('antrean')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Antrean Hari Ini</span>
                  </span>
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'pendaftaran' ? 'active' : ''}`} onClick={() => selectAdminMenu('pendaftaran')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    <span>Pendaftaran Loket</span>
                  </span>
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'pasien' ? 'active' : ''}`} onClick={() => selectAdminMenu('pasien')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    <span>Data Pasien</span>
                  </span>
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'sesi' ? 'active' : ''}`} onClick={() => selectAdminMenu('sesi')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>Jadwal &amp; Kuota</span>
                  </span>
                </button>
              </div>

              <div className="dash-nav-section">
                <div className="dash-nav-label">Kasir &amp; Keuangan</div>
                <button type="button" className={`dash-nav-item ${adminTab === 'kasir' ? 'active' : ''}`} onClick={() => selectAdminMenu('kasir')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    <span>Kasir &amp; Tagihan</span>
                  </span>
                  {unpaidCount > 0 && <span className="dash-nav-badge">{unpaidCount}</span>}
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'keuangan' ? 'active' : ''}`} onClick={() => selectAdminMenu('keuangan')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <span>Rekap Keuangan</span>
                  </span>
                </button>
              </div>

              <div className="dash-nav-section">
                <div className="dash-nav-label">Farmasi &amp; Notifikasi</div>
                <button type="button" className={`dash-nav-item ${adminTab === 'stok' ? 'active' : ''}`} onClick={() => selectAdminMenu('stok')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <span>Inventaris Obat &amp; Alkes</span>
                  </span>
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'riwayat_harga' ? 'active' : ''}`} onClick={() => selectAdminMenu('riwayat_harga')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    <span>Riwayat Harga Obat</span>
                  </span>
                </button>
                <button type="button" className={`dash-nav-item ${adminTab === 'email' ? 'active' : ''}`} onClick={() => selectAdminMenu('email')}>
                  <span className="dash-nav-item-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span>Notifikasi Email</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {/* MENU: BIDAN (RME) */}
          {currentRole === 'DOKTER' && (
            <div className="dash-nav-section">
              <div className="dash-nav-label">Rekam Medis Bidan</div>
              <button
                type="button"
                className={`dash-nav-item ${rmeTab === 'input' ? 'active' : ''}`}
                onClick={() => { setRmeTab('input'); setSidebarOpen(false); }}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  <span>Input Pemeriksaan (SOAP)</span>
                </span>
              </button>
              <button
                type="button"
                className={`dash-nav-item ${rmeTab === 'riwayat' ? 'active' : ''}`}
                onClick={() => { setRmeTab('riwayat'); setSidebarOpen(false); }}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span>Riwayat RME Pasien</span>
                </span>
              </button>
            </div>
          )}

          {/* MENU: SUPERADMIN */}
          {currentRole === 'SUPERADMIN' && (
            <div className="dash-nav-section">
              <div className="dash-nav-label">Pengawasan Sistem</div>
              <button
                type="button"
                className="dash-nav-item active"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Log Audit Sistem</span>
                </span>
              </button>
            </div>
          )}

          {/* MENU: PASIEN */}
          {currentRole === 'PASIEN' && (
            <div className="dash-nav-section">
              <div className="dash-nav-label">Menu Pasien</div>
              <button
                type="button"
                className={`dash-nav-item ${pasienTab === 'tiket' ? 'active' : ''}`}
                onClick={() => { setPasienTab('tiket'); setSidebarOpen(false); }}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Antrean &amp; Jadwal Saya</span>
                </span>
              </button>
              <button
                type="button"
                className="dash-nav-item"
                onClick={() => { setSidebarOpen(false); setShowPatientReservationModal(true); }}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Buat Reservasi Baru</span>
                </span>
              </button>
              <button
                type="button"
                className={`dash-nav-item ${pasienTab === 'lokasi' ? 'active' : ''}`}
                onClick={() => { setPasienTab('lokasi'); setSidebarOpen(false); }}
              >
                <span className="dash-nav-item-left">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Lokasi Praktik</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer: User Profile + Web Publik (keeps session!) + Logout */}
        <div className="dash-sidebar-footer">
          <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeUserName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {currentRole === 'DOKTER' ? `SIPB: ${KLINIK_INFO.sipb}` : roleDisplayLabel}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: onGoToHome ? '1fr 1fr' : '1fr', gap: '0.5rem' }}>
            {onGoToHome && (
              <button
                type="button"
                onClick={() => { setSidebarOpen(false); onGoToHome(); }}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.5rem', fontSize: '0.78rem' }}
              >
                Web Publik
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                session.bersihkan();
                onLogout();
              }}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.5rem', fontSize: '0.78rem', color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dash-main">
        {/* Mobile Sticky Topbar */}
        <header className="dash-mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', flexShrink: 0 }}
              aria-label="Buka menu navigasi"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeSectionTitle}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                PMB Bdn. Ria Indrasti
              </div>
            </div>
          </div>

          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '9999px', background: 'var(--color-primary-tint)', color: 'var(--color-primary-dark)', flexShrink: 0 }}>
            {roleDisplayLabel}
          </span>
        </header>

        {/* Desktop Sticky Topbar */}
        <header className="dash-desktop-topbar">
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {activeSectionTitle}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem', color: '#64748b' }}>
            <span>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>

        <main className="dash-content">
          {/* =========================================================================
              ROLE 1: SUPERADMIN — AUDIT LOG
              ========================================================================= */}
          {currentRole === 'SUPERADMIN' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                    Riwayat Aktivitas &amp; Audit Sistem
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Catatan aktivitas autentikasi, pendaftaran, pemeriksaan, dan transaksi klinik.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDownloadConfirm(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.55rem 0.95rem' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Ekspor CSV</span>
                </button>
              </div>

              <div className="dash-grid-3" style={{ marginBottom: '1.25rem' }}>
                <div className="dash-card">
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Total Aktivitas Tercatat</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '0.25rem' }}>
                    {auditLogs.length}
                  </div>
                </div>
                <div className="dash-card">
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Akun Pengguna Terdaftar</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                    {totalAkunPengguna} Pengguna
                  </div>
                </div>
                <div className="dash-card">
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status Pencatatan</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                    Aktif
                  </div>
                </div>
              </div>

              <div className="dash-card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {['SEMUA', 'LOGIN', 'INSERT', 'UPDATE', 'DELETE'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setAuditFilter(f); setAuditPage(1); }}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: '1px solid #cbd5e1',
                        background: auditFilter === f ? 'var(--color-primary)' : '#ffffff',
                        color: auditFilter === f ? '#ffffff' : '#475569'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div style={{ minWidth: '240px', flex: '0 1 280px' }}>
                  <input
                    type="text"
                    className="dash-input"
                    placeholder="Cari pengguna, aksi, atau IP..."
                    value={auditSearch}
                    onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  />
                </div>
              </div>

              <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Waktu</th>
                        <th>Pengguna</th>
                        <th>Peran</th>
                        <th>Keterangan</th>
                        <th style={{ textAlign: 'right' }}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            Tidak ada catatan aktivitas yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedAuditLogs.map((log) => (
                          <tr key={log.log_id}>
                            <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>#{log.log_id}</td>
                            <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{log.waktu}</td>
                            <td style={{ fontWeight: 600 }}>{log.user_ref}</td>
                            <td>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#f1f5f9', color: '#334155' }}>
                                {log.peran === 'DOKTER' ? 'BIDAN' : log.peran}
                              </span>
                            </td>
                            <td>{formatAktivitasManusia(log.aksi, log.tabel, log.user_ref, log.nilai_lama)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedAuditLog(log)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalAuditPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <span>
                      Menampilkan {Math.min((auditPage - 1) * auditPerPage + 1, filteredAuditLogs.length)}–{Math.min(auditPage * auditPerPage, filteredAuditLogs.length)} dari {filteredAuditLogs.length} baris
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={auditPage === 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                      >
                        Sebelumnya
                      </button>
                      <span style={{ fontWeight: 700, color: '#0f172a', padding: '0 0.4rem' }}>
                        {auditPage} / {totalAuditPages}
                      </span>
                      <button
                        type="button"
                        disabled={auditPage === totalAuditPages}
                        onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedAuditLog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div className="dash-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Detail Log #{selectedAuditLog.log_id}</h3>
                      <button type="button" onClick={() => setSelectedAuditLog(null)} style={{ fontSize: '1.2rem', color: '#64748b' }}>&times;</button>
                    </div>
                    <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.5, marginBottom: '1rem' }}>
                      {JSON.stringify(
                        {
                          log_id: selectedAuditLog.log_id,
                          waktu: selectedAuditLog.waktu,
                          pengguna: selectedAuditLog.user_ref,
                          peran: selectedAuditLog.peran === 'DOKTER' ? 'BIDAN' : selectedAuditLog.peran,
                          aksi: selectedAuditLog.aksi,
                          target: selectedAuditLog.tabel,
                          id_baris: selectedAuditLog.id_baris,
                          ip_address: selectedAuditLog.ip_address,
                          keterangan: selectedAuditLog.nilai_baru
                        },
                        null,
                        2
                      )}
                    </pre>
                    <button type="button" onClick={() => setSelectedAuditLog(null)} className="btn btn-secondary" style={{ width: '100%' }}>
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {showDownloadConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div className="dash-card" style={{ maxWidth: '460px', width: '100%' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Ekspor Log Audit (CSV)</h3>
                    <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.25rem' }}>
                      Unduh {auditLogs.length} baris catatan aktivitas ke perangkat Anda dalam format CSV?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setShowDownloadConfirm(false)} className="btn btn-secondary">
                        Batal
                      </button>
                      <button type="button" onClick={handleDownloadCsv} className="btn btn-primary">
                        Unduh CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              ROLE 2: ADMIN OPERASIONAL
              ========================================================================= */}
          {currentRole === 'ADMIN_LOKAL' && (
            <ErrorBoundary fallbackTitle="Kendala Memuat Panel Operasional">
              <div>
                {callAlert && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.85rem 1.15rem', borderRadius: '10px', marginBottom: '1.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
                    {callAlert}
                  </div>
                )}

                {/* 1. ANTREAN HARI INI — SLIM METRIC STRIP + CLEAN LEDGER TABLE */}
                {adminTab === 'antrean' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>Antrean Ruang Periksa</h2>
                        <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          Tagihan dibuat otomatis saat pendaftaran dan diperbarui saat pemeriksaan selesai.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <div className="dash-metric-strip">
                          <span>
                            <span style={{ color: '#6b7280' }}>Dilayani:</span>{' '}
                            <strong style={{ color: '#b45309' }}>{activeQueueNum}</strong>
                          </span>
                          <span className="dash-metric-divider" />
                          <span>
                            <span style={{ color: '#6b7280' }}>Menunggu:</span>{' '}
                            <strong style={{ color: '#111827' }}>
                              {queueList.filter((q) => q.status === 'MENUNGGU').length} Pasien
                            </strong>
                          </span>
                          {sesiList[0] && (
                            <>
                              <span className="dash-metric-divider" />
                              <span>
                                <span style={{ color: '#6b7280' }}>Kuota Sesi:</span>{' '}
                                <strong style={{ color: '#047857' }}>
                                  {Number(sesiList[0].kuota_terisi) || 0}/{Number(sesiList[0].kuota_maks) || 15}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>

                        {(() => {
                          const nextPatient = queueList.find((q) => q.status === 'MENUNGGU');
                          return nextPatient ? (
                            <button
                              type="button"
                              onClick={() => handleCallQueue(nextPatient.no, nextPatient.nama, nextPatient.reservasi_id)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.78rem', padding: '0.52rem 0.9rem', borderRadius: '8px' }}
                            >
                              Panggil Berikutnya ({nextPatient.no})
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {(
                            [
                              { key: 'SEMUA', label: `Semua (${queueList.length})` },
                              { key: 'MENUNGGU', label: `Menunggu (${queueList.filter((q) => q.status === 'MENUNGGU').length})` },
                              { key: 'DIPANGGIL', label: `Dipanggil (${queueList.filter((q) => q.status === 'DIPANGGIL').length})` },
                              { key: 'SELESAI', label: `Selesai (${queueList.filter((q) => q.status === 'SELESAI').length})` }
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              className={`dash-filter-pill ${queueStatusFilter === tab.key ? 'active' : ''}`}
                              onClick={() => setQueueStatusFilter(tab.key)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="dash-input"
                            placeholder="Cari no. antrean / nama..."
                            value={queueSearch}
                            onChange={(e) => setQueueSearch(e.target.value)}
                            style={{ width: '210px', padding: '0.38rem 0.65rem', fontSize: '0.78rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => setAdminTab('pendaftaran')}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderRadius: '7px' }}
                          >
                            + Walk-In Loket
                          </button>
                        </div>
                      </div>

                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>No. Antrean</th>
                              <th>Tanggal</th>
                              <th>Pasien</th>
                              <th>Layanan</th>
                              <th>Jam Sesi</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredQueueList.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ padding: '2.25rem', textAlign: 'center', color: '#6b7280' }}>
                                  Tidak ada data antrean pada filter ini.
                                </td>
                              </tr>
                            ) : (
                              filteredQueueList.map((q, idx) => (
                                <tr key={q.reservasi_id || `${q.tanggal}-${q.no}-${idx}`} style={{ background: q.status === 'DIPANGGIL' ? '#faf5fe' : 'transparent' }}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{q.no}</td>
                                  <td style={{ whiteSpace: 'nowrap', color: '#6b7280' }}>
                                    {q.tanggal ? new Date(q.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Hari Ini'}
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#111827' }}>{q.nama}</td>
                                  <td style={{ color: '#4b5563' }}>{q.layanan}</td>
                                  <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{q.sesi}</td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        padding: '0.18rem 0.5rem',
                                        borderRadius: '5px',
                                        border: `1px solid ${q.status === 'SELESAI' ? '#a7f3d0' : q.status === 'DIPANGGIL' ? '#fde68a' : '#e5e7eb'}`,
                                        background: q.status === 'SELESAI' ? '#ecfdf5' : q.status === 'DIPANGGIL' ? '#fffbeb' : '#f9fafb',
                                        color: q.status === 'SELESAI' ? '#065f46' : q.status === 'DIPANGGIL' ? '#92400e' : '#4b5563'
                                      }}
                                    >
                                      {q.status}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {q.status !== 'SELESAI' ? (
                                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleCallQueue(q.no, q.nama, q.reservasi_id)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                        >
                                          Panggil
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleFinishQueue(q.no, q.reservasi_id)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#065f46', background: '#ecfdf5', borderColor: '#a7f3d0' }}
                                        >
                                          Selesai
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                                        Selesai
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PENDAFTARAN LOKET (WALK-IN) — FULL CONTAINER WIDTH */}
                {adminTab === 'pendaftaran' && (
                  <div className="dash-card" style={{ width: '100%' }}>
                    <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                        Formulir Pendaftaran Pasien Loket (Walk-In)
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: '#64748b' }}>
                        Masukkan identitas pasien dan pilih layanan yang dituju. Nomor antrean dan draf tagihan layanan akan dibuat secara otomatis.
                      </p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (walkinForm.nik.trim().length !== 16) {
                          notify('NIK wajib berjumlah 16 digit angka.', 'error');
                          return;
                        }
                        setWalkinSubmitting(true);
                        try {
                          const unitRes = await apiClient.post('/unit-pelayanan/list', {});
                          const units: any[] = unitRes.data?.data ?? [];
                          const unit = units.find((u) => String(u.nama ?? '').toLowerCase().includes('kia')) ?? units[0];
                          if (!unit?.unit_id) {
                            notify('Unit pelayanan belum tersedia.', 'error');
                            setWalkinSubmitting(false);
                            return;
                          }
                          const res = await apiClient.post('/pasien/walk-in', {
                            nik: walkinForm.nik.trim(),
                            nama: walkinForm.nama.trim(),
                            jenis_kelamin: 'P',
                            tgl_lahir: walkinForm.tgl_lahir,
                            tempat_lahir: walkinForm.tempat_lahir.trim() || '-',
                            alamat: walkinForm.alamat.trim(),
                            no_telepon: walkinForm.no_telepon.trim(),
                            gol_darah: 'O',
                            status_pernikahan: 'MENIKAH',
                            pekerjaan: 'Lainnya',
                            email: kirimEmailNotif && walkinEmail.trim() ? walkinEmail.trim() : undefined,
                            unit_id: unit.unit_id,
                            layanan_id: walkinForm.layanan_id || undefined,
                            jadwal_id: walkinSesiId || undefined,
                            jenis_kunjungan: 'RAWAT_JALAN'
                          });

                          const noUrut = res.data?.data?.nomor_antrean;
                          const labelNo = noUrut ? `A-${String(noUrut).padStart(3, '0')}` : 'Baru';
                          notify(`Pendaftaran pasien ${walkinForm.nama} berhasil (${labelNo}). Tagihan layanan awal otomatis tercatat.`, 'success');

                          refreshReservasi();
                          refreshKeuanganDanTagihan();
                          apiClient.post('/pasien/identitas/list', { limit: 100 }).then((r) => {
                            if (r.data?.data) setRegisteredPatients(r.data.data);
                          }).catch(() => {});
                          apiClient.post('/public/sesi/list', {}).then((r) => {
                            if (r.data?.data) setSesiList(r.data.data);
                          }).catch(() => {});

                          setWalkinForm((prev) => ({
                            nik: '',
                            nama: '',
                            tgl_lahir: '',
                            tempat_lahir: '',
                            alamat: '',
                            no_telepon: '',
                            layanan_id: prev.layanan_id
                          }));
                          setWalkinEmail('');
                          setAdminTab('antrean');
                        } catch (err) {
                          notify(pesanErrorApi(err, 'Gagal mendaftarkan pasien walk-in.'), 'error');
                        } finally {
                          setWalkinSubmitting(false);
                        }
                      }}
                    >
                      <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
                        <div>
                          <label className="dash-label">Nomor Induk Kependudukan (NIK) *</label>
                          <input
                            type="text"
                            required
                            maxLength={16}
                            className="dash-input"
                            placeholder="16 digit NIK sesuai KTP"
                            value={walkinForm.nik}
                            onChange={(e) => setWalkinForm({ ...walkinForm, nik: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Nama Lengkap Pasien *</label>
                          <input
                            type="text"
                            required
                            className="dash-input"
                            placeholder="Contoh: Ny. Dewi Lestari"
                            value={walkinForm.nama}
                            onChange={(e) => setWalkinForm({ ...walkinForm, nama: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="dash-grid-3" style={{ marginBottom: '1rem' }}>
                        <div>
                          <label className="dash-label">Tanggal Lahir *</label>
                          <input
                            type="date"
                            required
                            className="dash-input"
                            value={walkinForm.tgl_lahir}
                            onChange={(e) => setWalkinForm({ ...walkinForm, tgl_lahir: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Tempat Lahir</label>
                          <input
                            type="text"
                            className="dash-input"
                            placeholder="Contoh: Jambi"
                            value={walkinForm.tempat_lahir}
                            onChange={(e) => setWalkinForm({ ...walkinForm, tempat_lahir: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Nomor Telepon / WhatsApp *</label>
                          <input
                            type="tel"
                            required
                            className="dash-input"
                            placeholder="08xxxxxxxxxx"
                            value={walkinForm.no_telepon}
                            onChange={(e) => setWalkinForm({ ...walkinForm, no_telepon: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label className="dash-label">Alamat Domisili *</label>
                        <input
                          type="text"
                          required
                          className="dash-input"
                          placeholder="Alamat tempat tinggal saat ini"
                          value={walkinForm.alamat}
                          onChange={(e) => setWalkinForm({ ...walkinForm, alamat: e.target.value })}
                        />
                      </div>

                      <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
                        <div>
                          <label className="dash-label">Pilih Jadwal Sesi Praktik *</label>
                          <select
                            className="dash-select"
                            value={walkinSesiId}
                            onChange={(e) => setWalkinSesiId(e.target.value)}
                          >
                            <option value="">-- Pilih Jadwal Sesi --</option>
                            {sesiList.map((s, idx) => {
                              const kuotaMaks = Number(s.kuota_maks) || 15;
                              const sisa = typeof s.sisa_kuota === 'number' ? s.sisa_kuota : kuotaMaks;
                              return (
                                <option key={s.jadwal_id || s.sesi_id || idx} value={s.jadwal_id || s.sesi_id}>
                                  {s.tanggal ? `${String(s.tanggal).split('T')[0]} ` : ''}({s.jam_mulai ? String(s.jam_mulai).slice(0, 5) : '08:00'} - {s.jam_selesai ? String(s.jam_selesai).slice(0, 5) : '12:00'} WIB) — Sisa {sisa} kuota
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="dash-label">Layanan Pemeriksaan yang Dituju *</label>
                          <select
                            required
                            className="dash-select"
                            value={walkinForm.layanan_id}
                            onChange={(e) => setWalkinForm({ ...walkinForm, layanan_id: e.target.value })}
                          >
                            <option value="">-- Pilih Layanan Medis --</option>
                            {masterLayananList.map((l) => (
                              <option key={l.layanan_id} value={l.layanan_id}>
                                {l.nama}{l.harga > 0 ? ` — Rp ${l.harga.toLocaleString('id-ID')}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label className="dash-label">Alamat Email Pasien (Opsional)</label>
                        <input
                          type="email"
                          className="dash-input"
                          placeholder="Contoh: pasien@email.com"
                          value={walkinEmail}
                          onChange={(e) => setWalkinEmail(e.target.value)}
                        />
                      </div>

                      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          id="kirimEmailNotif"
                          checked={kirimEmailNotif}
                          onChange={(e) => setKirimEmailNotif(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                        />
                        <label htmlFor="kirimEmailNotif" style={{ fontSize: '0.8125rem', color: '#475569', cursor: 'pointer' }}>
                          Simpan email pasien untuk pengingat jadwal kontrol (H-1)
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="submit"
                          disabled={walkinSubmitting}
                          className="btn btn-primary"
                          style={{ padding: '0.75rem 1.75rem', fontWeight: 700 }}
                        >
                          {walkinSubmitting ? 'Memproses Pendaftaran...' : 'Daftarkan Pasien & Terbitkan Antrean'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 3. DATA PASIEN TERDAFTAR */}
                {adminTab === 'pasien' && (
                  <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Daftar Pasien Terdaftar</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Total {registeredPatients.length} pasien tercatat.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="dash-input"
                          placeholder="Cari nama, NIK, atau No. RM..."
                          value={patientSearchTerm}
                          onChange={(e) => setPatientSearchTerm(e.target.value)}
                          style={{ width: '240px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setAdminTab('pendaftaran')}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8125rem', padding: '0.55rem 0.95rem' }}
                        >
                          + Pasien Baru
                        </button>
                      </div>
                    </div>

                    <div className="dash-table-wrap">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            <th>No. RM</th>
                            <th>NIK</th>
                            <th>Nama Lengkap</th>
                            <th>JK</th>
                            <th>Tgl Lahir</th>
                            <th>Telepon</th>
                            <th>Alamat</th>
                            <th style={{ textAlign: 'right' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registeredPatients.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '2.25rem', color: '#64748b' }}>
                                Belum ada data pasien terdaftar.
                              </td>
                            </tr>
                          ) : (
                            registeredPatients
                              .filter(
                                (p) =>
                                  !patientSearchTerm ||
                                  (p.nama && p.nama.toLowerCase().includes(patientSearchTerm.toLowerCase())) ||
                                  (p.nik && p.nik.includes(patientSearchTerm)) ||
                                  (p.no_rm && p.no_rm.includes(patientSearchTerm))
                              )
                              .map((p, idx) => (
                                <tr key={p.pasien_id || idx}>
                                  <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                                    {p.no_rm || `RM-${String(idx + 1).padStart(4, '0')}`}
                                  </td>
                                  <td style={{ fontFamily: 'monospace' }}>{p.nik}</td>
                                  <td style={{ fontWeight: 600 }}>{p.nama}</td>
                                  <td>{p.jenis_kelamin === 'L' ? 'L' : 'P'}</td>
                                  <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {p.tgl_lahir ? new Date(p.tgl_lahir).toLocaleDateString('id-ID') : '-'}
                                  </td>
                                  <td style={{ color: '#475569' }}>{p.no_telepon || '-'}</td>
                                  <td style={{ color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.alamat || '-'}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => selectPatientForRme(p, true)}
                                      className="btn btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                                    >
                                      Pilih RME
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

                {/* 4. JADWAL SESI & KUOTA */}
                {adminTab === 'sesi' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="dash-card">
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                        Tambah Jadwal Sesi Praktik
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                        Atur tanggal, jam operasional, dan kuota kunjungan pasien.
                      </p>

                      <form onSubmit={handleCreateSesi} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', alignItems: 'flex-end' }}>
                        <div>
                          <label className="dash-label">Tanggal</label>
                          <input
                            type="date"
                            required
                            className="dash-input"
                            value={newSesiForm.tanggal}
                            onChange={(e) => setNewSesiForm({ ...newSesiForm, tanggal: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Jam Mulai</label>
                          <input
                            type="time"
                            required
                            className="dash-input"
                            value={newSesiForm.jam_mulai}
                            onChange={(e) => setNewSesiForm({ ...newSesiForm, jam_mulai: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Jam Selesai</label>
                          <input
                            type="time"
                            required
                            className="dash-input"
                            value={newSesiForm.jam_selesai}
                            onChange={(e) => setNewSesiForm({ ...newSesiForm, jam_selesai: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Kuota Pasien</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            required
                            className="dash-input"
                            value={newSesiForm.kuota_maks}
                            onChange={(e) => setNewSesiForm({ ...newSesiForm, kuota_maks: Number(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <label className="dash-label">Durasi (Menit)</label>
                          <input
                            type="number"
                            min="5"
                            max="60"
                            required
                            className="dash-input"
                            value={newSesiForm.durasi_per_pasien}
                            onChange={(e) => setNewSesiForm({ ...newSesiForm, durasi_per_pasien: Number(e.target.value) || 20 })}
                          />
                        </div>
                        <div>
                          <button type="submit" disabled={isSavingSesi} className="btn btn-primary" style={{ width: '100%', padding: '0.62rem' }}>
                            {isSavingSesi ? 'Menyimpan...' : '+ Tambah Sesi'}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Daftar Sesi Praktik Aktif</h3>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                          {sesiList.length} Sesi
                        </span>
                      </div>
                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Jam Sesi</th>
                              <th>Durasi</th>
                              <th>Kuota Maks</th>
                              <th>Terisi</th>
                              <th>Sisa</th>
                              <th style={{ textAlign: 'right' }}>Sesuaikan Kuota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sesiList.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                  Belum ada sesi praktik terjadwal.
                                </td>
                              </tr>
                            ) : (
                              sesiList.map((sesi, idx) => {
                                const kuotaMaks = Number(sesi.kuota_maks) || 15;
                                const kuotaTerisi = Number(sesi.kuota_terisi) || 0;
                                const sisa = Math.max(0, kuotaMaks - kuotaTerisi);
                                return (
                                  <tr key={sesi.jadwal_id || idx}>
                                    <td style={{ fontWeight: 600 }}>
                                      {sesi.tanggal ? new Date(sesi.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                    </td>
                                    <td style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                                      {sesi.jam_mulai ? String(sesi.jam_mulai).slice(0, 5) : '08:00'} - {sesi.jam_selesai ? String(sesi.jam_selesai).slice(0, 5) : '12:00'} WIB
                                    </td>
                                    <td>{sesi.durasi_per_pasien || 20} mnt</td>
                                    <td style={{ fontWeight: 700 }}>{kuotaMaks}</td>
                                    <td>{kuotaTerisi}</td>
                                    <td style={{ color: sisa > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{sisa}</td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSesiKuota(sesi.jadwal_id, kuotaMaks + 5)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                                        >
                                          +5
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSesiKuota(sesi.jadwal_id, kuotaMaks + 1)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                                        >
                                          +1
                                        </button>
                                        {kuotaMaks > kuotaTerisi && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSesiKuota(sesi.jadwal_id, Math.max(kuotaTerisi, kuotaMaks - 1))}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: '#dc2626' }}
                                          >
                                            -1
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. KASIR & TAGIHAN OTOMATIS — SLIM STRIP + LEDGER TABLE + SLIDE-OVER DRAWER */}
                {adminTab === 'kasir' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                          Kasir &amp; Tagihan Otomatis
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          Tagihan ditarik otomatis dari layanan pendaftaran dan obat RME Bidan. Klik &ldquo;Lunasi&rdquo; untuk mencatat pembayaran.
                        </p>
                      </div>

                      <div className="dash-metric-strip">
                        <span>
                          <span style={{ color: '#6b7280' }}>Belum Lunas:</span>{' '}
                          <strong style={{ color: '#b45309' }}>{unpaidCount} Pasien</strong>
                        </span>
                        <span className="dash-metric-divider" />
                        <span>
                          <span style={{ color: '#6b7280' }}>Piutang:</span>{' '}
                          <strong style={{ color: '#111827' }}>Rp {totalPiutangBelumLunas.toLocaleString('id-ID')}</strong>
                        </span>
                        <span className="dash-metric-divider" />
                        <span>
                          <span style={{ color: '#6b7280' }}>Penerimaan Kasir:</span>{' '}
                          <strong style={{ color: '#047857' }}>Rp {totalInflowKasir.toLocaleString('id-ID')}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {(
                            [
                              { key: 'SEMUA', label: `Semua (${tagihanList.length})` },
                              { key: 'BELUM_LUNAS', label: `Belum Lunas (${unpaidCount})` },
                              { key: 'LUNAS', label: `Lunas (${tagihanList.filter((t) => t.status === 'LUNAS').length})` }
                            ] as const
                          ).map((st) => (
                            <button
                              key={st.key}
                              type="button"
                              className={`dash-filter-pill ${tagihanStatusFilter === st.key ? 'active' : ''}`}
                              onClick={() => setTagihanStatusFilter(st.key)}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="dash-input"
                            placeholder="Cari no. tagihan / nama..."
                            value={tagihanSearch}
                            onChange={(e) => setTagihanSearch(e.target.value)}
                            style={{ width: '210px', padding: '0.38rem 0.65rem', fontSize: '0.78rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenCreateBilling()}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '7px' }}
                          >
                            Koreksi Manual
                          </button>
                          <button
                            type="button"
                            onClick={refreshKeuanganDanTagihan}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '7px' }}
                          >
                            Muat Ulang
                          </button>
                        </div>
                      </div>

                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>No. Tagihan</th>
                              <th>Tanggal</th>
                              <th>Pasien</th>
                              <th>Rincian Otomatis (Layanan + Obat)</th>
                              <th style={{ textAlign: 'right' }}>Total</th>
                              <th style={{ textAlign: 'right' }}>Dibayar</th>
                              <th style={{ textAlign: 'right' }}>Sisa</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTagihanList.length === 0 ? (
                              <tr>
                                <td colSpan={9} style={{ padding: '2.25rem', textAlign: 'center', color: '#6b7280' }}>
                                  Belum ada data tagihan pada kategori ini.
                                </td>
                              </tr>
                            ) : (
                              filteredTagihanList.map((tagihan, idx) => {
                                const tot = Number(tagihan.total_tagihan !== undefined ? tagihan.total_tagihan : tagihan.total || 0);
                                const dibayar = Number(tagihan.total_dibayar !== undefined ? tagihan.total_dibayar : tagihan.terbayar || 0);
                                const sisaNominal = Math.max(0, Number(tagihan.sisa !== undefined ? tagihan.sisa : tot - dibayar));
                                const noTag = tagihan.no_tagihan || `INV-${String(tagihan.tagihan_id).slice(0, 6).toUpperCase()}`;
                                return (
                                  <tr key={tagihan.tagihan_id || idx}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{noTag}</td>
                                    <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
                                      {tagihan.tgl_terbit ? new Date(tagihan.tgl_terbit).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                    </td>
                                    <td style={{ fontWeight: 600, color: '#111827' }}>{tagihan.nama_pasien || 'Pasien'}</td>
                                    <td style={{ color: '#4b5563', maxWidth: '280px', fontSize: '0.78rem' }}>
                                      {tagihan.rincian_item || 'Layanan Pemeriksaan'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      Rp {tot.toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      Rp {dibayar.toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ textAlign: 'right', color: sisaNominal > 0 ? '#dc2626' : '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      Rp {sisaNominal.toLocaleString('id-ID')}
                                    </td>
                                    <td>
                                      <span
                                        style={{
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          padding: '0.18rem 0.5rem',
                                          borderRadius: '5px',
                                          whiteSpace: 'nowrap',
                                          border: `1px solid ${tagihan.status === 'LUNAS' ? '#a7f3d0' : '#fde68a'}`,
                                          background: tagihan.status === 'LUNAS' ? '#ecfdf5' : '#fffbeb',
                                          color: tagihan.status === 'LUNAS' ? '#065f46' : '#92400e'
                                        }}
                                      >
                                        {tagihan.status === 'LUNAS' ? 'LUNAS' : 'BELUM LUNAS'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      {tagihan.status !== 'LUNAS' ? (
                                        <button
                                          type="button"
                                          onClick={() => openKasirDrawer(tagihan)}
                                          className="btn btn-primary"
                                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                        >
                                          Lunasi
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Terverifikasi</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Slide-Over Receipt & Payment Drawer */}
                    {kasirDrawerTagihan && (() => {
                      const tot = Number(kasirDrawerTagihan.total_tagihan !== undefined ? kasirDrawerTagihan.total_tagihan : kasirDrawerTagihan.total || 0);
                      const dibayar = Number(kasirDrawerTagihan.total_dibayar !== undefined ? kasirDrawerTagihan.total_dibayar : kasirDrawerTagihan.terbayar || 0);
                      const sisaNominal = Math.max(0, Number(kasirDrawerTagihan.sisa !== undefined ? kasirDrawerTagihan.sisa : tot - dibayar));
                      const noTag = kasirDrawerTagihan.no_tagihan || `INV-${String(kasirDrawerTagihan.tagihan_id).slice(0, 6).toUpperCase()}`;

                      return (
                        <div className="dash-drawer-backdrop" onClick={closeKasirDrawer}>
                          <div className="dash-drawer-panel" onClick={(e) => e.stopPropagation()}>
                            <form onSubmit={handleKasirSubmit} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%', padding: '1.5rem' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                                  <div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                                      {noTag}
                                    </div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary-dark)', marginTop: '0.15rem' }}>
                                      {kasirDrawerTagihan.nama_pasien || 'Pasien'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                      Terbit: {kasirDrawerTagihan.tgl_terbit ? new Date(kasirDrawerTagihan.tgl_terbit).toLocaleDateString('id-ID') : '-'}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={closeKasirDrawer}
                                    style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#f3f4f6', color: '#4b5563', fontSize: '1.1rem', lineHeight: 1 }}
                                    aria-label="Tutup panel pembayaran"
                                  >
                                    &times;
                                  </button>
                                </div>

                                <div style={{ marginBottom: '1.15rem' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                                    Rincian Layanan &amp; Obat
                                  </div>
                                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#374151' }}>
                                    {kasirDrawerRincian.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {kasirDrawerRincian.map((rItem: any, rIdx: number) => {
                                          const layName = masterLayananList.find((l) => l.layanan_id === rItem.layanan_id)?.nama;
                                          const obtName = masterObatList.find((o) => o.obat_id === rItem.obat_id)?.nama_generik;
                                          const itemName = layName || obtName || 'Item Layanan / Obat';
                                          return (
                                            <div key={rItem.rincian_id || rIdx} className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                              <span>{itemName} ({rItem.qty || 1}x)</span>
                                              <span style={{ fontWeight: 600 }}>Rp {Number(rItem.subtotal || 0).toLocaleString('id-ID')}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div>{kasirDrawerTagihan.rincian_item || 'Layanan Pemeriksaan'}</div>
                                    )}
                                  </div>
                                </div>

                                <div className="tabular-nums" style={{ borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #e5e7eb', padding: '0.75rem 0', marginBottom: '1.15rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                                    <span>Total Tagihan</span>
                                    <span>Rp {tot.toLocaleString('id-ID')}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                                    <span>Sudah Dibayar</span>
                                    <span>Rp {dibayar.toLocaleString('id-ID')}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#111827', fontSize: '0.9rem', paddingTop: '0.25rem' }}>
                                    <span>Sisa Pelunasan</span>
                                    <span>Rp {sisaNominal.toLocaleString('id-ID')}</span>
                                  </div>
                                </div>

                                <div style={{ marginBottom: '0.85rem' }}>
                                  <label className="dash-label">Metode Pembayaran</label>
                                  <select
                                    className="dash-select"
                                    value={kasirForm.metode}
                                    onChange={(e) => setKasirForm({ ...kasirForm, metode: e.target.value as any })}
                                  >
                                    <option value="TUNAI">Tunai (Cash)</option>
                                    <option value="QRIS">QRIS</option>
                                    <option value="TRANSFER">Transfer Bank</option>
                                    <option value="BPJS">Penjamin BPJS</option>
                                  </select>
                                </div>

                                <div style={{ marginBottom: '0.85rem' }}>
                                  <label className="dash-label">Jenis Transaksi</label>
                                  <select
                                    className="dash-select"
                                    value={kasirForm.jenis}
                                    onChange={(e) => setKasirForm({ ...kasirForm, jenis: e.target.value as any })}
                                  >
                                    <option value="PELUNASAN">Pelunasan</option>
                                    <option value="CICILAN">Cicilan / Bertahap</option>
                                    <option value="UANG_MUKA">Uang Muka</option>
                                  </select>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                  <label className="dash-label">Nominal Dibayar (Rp)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    className="dash-input tabular-nums"
                                    value={kasirForm.jumlah}
                                    onChange={(e) => setKasirForm({ ...kasirForm, jumlah: e.target.value })}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                <button
                                  type="button"
                                  onClick={closeKasirDrawer}
                                  className="btn btn-secondary"
                                  style={{ flex: '0 0 auto', padding: '0.65rem 1rem', fontSize: '0.825rem' }}
                                >
                                  Batal
                                </button>
                                <button
                                  type="submit"
                                  disabled={kasirSubmitting}
                                  className="btn btn-primary"
                                  style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
                                >
                                  {kasirSubmitting ? 'Memproses...' : 'Konfirmasi Lunas'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 6. REKAPITULASI KEUANGAN (MURNI DATA DB TANPA KOLOM TERSINKRONISASI DB & TANPA HARGA/MARGIN FIKTIF) */}
                {adminTab === 'keuangan' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                          Rekapitulasi Penerimaan &amp; Layanan
                        </h3>
                        <p style={{ fontSize: '0.825rem', color: '#64748b' }}>
                          Ringkasan transaksi pembayaran kasir dan realisasi pemakaian layanan medis.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={refreshKeuanganDanTagihan}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
                      >
                        Muat Ulang Data
                      </button>
                    </div>

                    <div className="dash-grid-4">
                      <div className="dash-card">
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Penerimaan Kasir</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                          Rp {totalInflowKasir.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>Pembayaran diterima</div>
                      </div>
                      <div className="dash-card">
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Belum Lunas (Piutang)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                          Rp {totalPiutangBelumLunas.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{unpaidCount} tagihan menunggu</div>
                      </div>
                      <div className="dash-card">
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Nilai Tagihan</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                          Rp {totalNilaiTagihan.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{tagihanList.length} berkas tagihan</div>
                      </div>
                      <div className="dash-card">
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Frekuensi Pembayaran</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '0.25rem' }}>
                          {totalTransaksiKasir} Transaksi
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>Seluruh metode bayar</div>
                      </div>
                    </div>

                    {/* Tabel 1: Penerimaan Kasir per Metode Pembayaran (4 Kolom Bersih) */}
                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                          Rekapitulasi Penerimaan Kasir per Metode Pembayaran
                        </h4>
                      </div>
                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Metode Pembayaran</th>
                              <th>Jumlah Transaksi</th>
                              <th style={{ textAlign: 'right' }}>Total Penerimaan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rekapMetode.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                  Belum ada riwayat transaksi pembayaran kasir.
                                </td>
                              </tr>
                            ) : (
                              rekapMetode.map((item, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>
                                    {item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'}
                                  </td>
                                  <td style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                                    {item.metode === 'BPJS'
                                      ? 'Penjamin BPJS'
                                      : item.metode === 'QRIS'
                                      ? 'QRIS'
                                      : item.metode === 'TRANSFER'
                                      ? 'Transfer Bank'
                                      : 'Tunai (Cash)'}
                                  </td>
                                  <td>{item.jumlah_transaksi || 1} Transaksi</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                    Rp {(Number(item.total) || 0).toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tabel 2: Daftar Layanan Medis & Realisasi Tagihan Riil */}
                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                          Daftar Layanan Medis &amp; Realisasi Tagihan
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Menampilkan tarif resmi setiap layanan medis beserta jumlah tindakan yang benar-benar tercatat pada tagihan pasien.
                        </p>
                      </div>
                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Kode</th>
                              <th>Nama Layanan Medis</th>
                              <th>Kategori</th>
                              <th>Tarif Layanan</th>
                              <th>Jumlah Tindakan</th>
                              <th style={{ textAlign: 'right' }}>Total Tagihan Tercatat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {masterLayananList.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                  Belum ada data layanan medis.
                                </td>
                              </tr>
                            ) : (
                              masterLayananList.map((lay, idx) => (
                                <tr key={lay.layanan_id || idx}>
                                  <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{lay.kode}</td>
                                  <td style={{ fontWeight: 600 }}>{lay.nama}</td>
                                  <td style={{ color: '#475569' }}>{lay.kategori}</td>
                                  <td style={{ fontWeight: 600 }}>
                                    {lay.harga > 0 ? `Rp ${lay.harga.toLocaleString('id-ID')}` : 'Rp 0'}
                                  </td>
                                  <td>{lay.jumlah_tindakan} Tindakan</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: lay.total_realisasi > 0 ? '#16a34a' : '#64748b' }}>
                                    Rp {lay.total_realisasi.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. INVENTARIS OBAT & ALKES */}
                {adminTab === 'stok' && (
                  <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          Inventaris Obat &amp; Alat Kesehatan
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Pemantauan stok fisik dan batas minimum persediaan farmasi klinik.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setShowAddAlkesModal(true)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 0.9rem' }}
                        >
                          + Tambah Item Baru
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMutasiStokModal(true);
                            if (stokAlkes.length > 0 && !mutasiForm.obat_id) {
                              setMutasiForm((prev) => ({ ...prev, obat_id: stokAlkes[0].obat_id || stokAlkes[0].kode }));
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 0.9rem' }}
                        >
                          Catat Mutasi Stok
                        </button>
                      </div>
                    </div>

                    <div className="dash-table-wrap">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            <th>Kode</th>
                            <th>Nama Item</th>
                            <th>Kategori</th>
                            <th>Stok Saat Ini</th>
                            <th>Batas Minimum</th>
                            <th>Satuan</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stokAlkes.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: '2.25rem', textAlign: 'center', color: '#64748b' }}>
                                Belum ada data inventaris obat dan alkes.
                              </td>
                            </tr>
                          ) : (
                            stokAlkes.map((s) => (
                              <tr key={s.obat_id || s.kode}>
                                <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{s.kode}</td>
                                <td style={{ fontWeight: 600 }}>{s.nama}</td>
                                <td style={{ color: '#475569' }}>{s.kategori}</td>
                                <td style={{ fontWeight: 800, color: s.status === 'AMAN' ? '#16a34a' : '#dc2626' }}>{s.stok}</td>
                                <td style={{ color: '#64748b' }}>{s.min}</td>
                                <td style={{ color: '#475569' }}>{s.satuan}</td>
                                <td>
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '9999px',
                                      background: s.status === 'AMAN' ? '#dcfce7' : '#fee2e2',
                                      color: s.status === 'AMAN' ? '#166534' : '#991b1b'
                                    }}
                                  >
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 8. RIWAYAT HARGA OBAT */}
                {adminTab === 'riwayat_harga' && (
                  <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Daftar &amp; Riwayat Harga Obat</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Tarif harga jual obat yang otomatis digunakan pada perhitungan tagihan pasien.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setHargaError(null); setShowAddHargaModal(true); }}
                        className="btn btn-primary"
                        style={{ fontSize: '0.8125rem', padding: '0.5rem 0.9rem' }}
                      >
                        + Sesuaikan Harga Obat
                      </button>
                    </div>

                    <div className="dash-table-wrap">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            <th>Nama Obat / Alkes</th>
                            <th>Kategori</th>
                            <th>Harga Jual</th>
                            <th>Berlaku Mulai</th>
                            <th>Keterangan Perubahan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hargaLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '2.25rem', textAlign: 'center', color: '#64748b' }}>
                                Belum ada riwayat penyesuaian harga obat.
                              </td>
                            </tr>
                          ) : (
                            hargaLogs.map((h) => (
                              <tr key={h.harga_obat_id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{h.nama_obat}</div>
                                  {h.kode_obat && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.kode_obat}</div>}
                                </td>
                                <td style={{ color: '#475569' }}>{h.kategori}</td>
                                <td style={{ fontWeight: 700, color: '#16a34a' }}>
                                  Rp {(Number(h.harga_jual) || 0).toLocaleString('id-ID')}
                                </td>
                                <td style={{ color: '#64748b' }}>{h.berlaku_dari}</td>
                                <td style={{ color: '#475569' }}>{h.alasan || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 9. NOTIFIKASI EMAIL PASIEN */}
                {adminTab === 'email' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="dash-grid-3">
                      <div className="dash-card">
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Email Terkirim</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                          {emailLogs.filter((e) => e.status === 'TERKIRIM').length} Pesan
                        </div>
                      </div>
                      <div className="dash-card">
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Menunggu Antrean Kirim</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', marginTop: '0.25rem' }}>
                          {emailLogs.filter((e) => e.status === 'MENUNGGU').length} Pesan
                        </div>
                      </div>
                      <div className="dash-card">
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status Layanan Email</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '0.35rem' }}>
                          Aktif (SMTP)
                        </div>
                      </div>
                    </div>

                    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Riwayat Notifikasi Email Pasien</h3>
                      </div>
                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Nama Pasien</th>
                              <th>Email Tujuan</th>
                              <th>Jenis</th>
                              <th>Subjek</th>
                              <th>Waktu Kirim</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Pratinjau</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailLogs.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ padding: '2.25rem', textAlign: 'center', color: '#64748b' }}>
                                  Belum ada riwayat pengiriman notifikasi email.
                                </td>
                              </tr>
                            ) : (
                              emailLogs.map((e) => (
                                <tr key={e.notif_id}>
                                  <td style={{ fontWeight: 600 }}>{e.pasien_nama}</td>
                                  <td>{e.email_tujuan}</td>
                                  <td>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px', background: '#f1f5f9', color: '#334155' }}>
                                      {e.jenis}
                                    </span>
                                  </td>
                                  <td>{e.subjek}</td>
                                  <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{e.waktu_kirim}</td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '9999px',
                                        background: e.status === 'TERKIRIM' ? '#dcfce7' : '#fef3c7',
                                        color: e.status === 'TERKIRIM' ? '#166534' : '#92400e'
                                      }}
                                    >
                                      {e.status}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewEmail(e)}
                                      className="btn btn-secondary"
                                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                    >
                                      Lihat
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* =========================================================================
              ROLE 3: BIDAN — 2-PANEL CLINICAL RME WORKSPACE + AUTO-BILLING
              ========================================================================= */}
          {currentRole === 'DOKTER' && (
            <div>
              {rmeTab === 'input' && (() => {
                const sortedRmeQueue = [...queueList].sort((a, b) => {
                  const rank = (st: string) => (st === 'DIPANGGIL' ? 0 : st === 'MENUNGGU' ? 1 : 2);
                  return rank(a.status) - rank(b.status);
                });

                const effectiveMode = queueList.length === 0 ? 'pasien' : rmeLeftMode;
                const filterLower = rmeQueueFilter.toLowerCase().trim();

                const visibleQueueCards = sortedRmeQueue.filter((q) => {
                  if (!filterLower) return true;
                  return (
                    String(q.nama || '').toLowerCase().includes(filterLower) ||
                    String(q.no || '').toLowerCase().includes(filterLower) ||
                    String(q.nik || '').includes(filterLower) ||
                    String(q.layanan || '').toLowerCase().includes(filterLower)
                  );
                });

                const visiblePatientCards = registeredPatients.filter((p) => {
                  if (!filterLower) return true;
                  return (
                    String(p.nama || '').toLowerCase().includes(filterLower) ||
                    String(p.nik || '').includes(filterLower) ||
                    String(p.no_rm || '').toLowerCase().includes(filterLower)
                  );
                });

                const selectedLayananObj = masterLayananList.find((l) => l.layanan_id === rmeLayananId);
                const autoBillEstimate =
                  (selectedLayananObj?.harga || 0) +
                  rmeObatItems.reduce((acc, o) => acc + o.harga_satuan * o.qty, 0);

                return (
                  <div className="rme-workspace">
                    {/* LEFT PANEL: 1-CLICK PATIENT QUEUE & DIRECTORY */}
                    <div className="rme-queue-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <div>
                          <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#111827' }}>Daftar Pasien Periksa</div>
                          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Klik nama pasien untuk isi SOAP</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', background: '#eef2f6', padding: '0.2rem', borderRadius: '7px', marginBottom: '0.6rem' }}>
                        <button
                          type="button"
                          onClick={() => setRmeLeftMode('antrean')}
                          style={{
                            padding: '0.32rem 0.4rem',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: effectiveMode === 'antrean' ? '#ffffff' : 'transparent',
                            color: effectiveMode === 'antrean' ? '#111827' : '#6b7280',
                            boxShadow: effectiveMode === 'antrean' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                          }}
                        >
                          Antrean ({queueList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRmeLeftMode('pasien')}
                          style={{
                            padding: '0.32rem 0.4rem',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: effectiveMode === 'pasien' ? '#ffffff' : 'transparent',
                            color: effectiveMode === 'pasien' ? '#111827' : '#6b7280',
                            boxShadow: effectiveMode === 'pasien' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                          }}
                        >
                          Semua ({registeredPatients.length})
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          className="dash-input"
                          placeholder="Cari nama / No. RM / NIK..."
                          value={rmeQueueFilter}
                          onChange={(e) => setRmeQueueFilter(e.target.value)}
                          style={{ padding: '0.42rem 0.65rem', fontSize: '0.78rem' }}
                        />
                        {/^\d{16}$/.test(rmeQueueFilter.trim()) && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.72rem', flexShrink: 0 }}
                            onClick={() => {
                              const nikClean = rmeQueueFilter.trim();
                              apiClient
                                .post('/public/pasien/cek', { nik: nikClean })
                                .then((res) => {
                                  if (res.data?.data?.terdaftar) {
                                    selectPatientForRme(
                                      {
                                        pasien_id: res.data.data.pasien_id,
                                        nama: res.data.data.nama || 'Pasien Terdaftar',
                                        nik: nikClean,
                                        no_rm: res.data.data.no_rm || '-',
                                        alamat: 'Kota Jambi'
                                      },
                                      false
                                    );
                                  } else {
                                    notify('NIK belum terdaftar.', 'error');
                                  }
                                })
                                .catch(() => notify('Gagal memeriksa NIK.', 'error'));
                            }}
                          >
                            Cek
                          </button>
                        )}
                      </div>

                      <div className="rme-queue-list">
                        {effectiveMode === 'antrean' ? (
                          visibleQueueCards.length === 0 ? (
                            <div style={{ padding: '1.5rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', color: '#6b7280' }}>
                              Tidak ada antrean yang cocok.
                            </div>
                          ) : (
                            visibleQueueCards.map((q, idx) => {
                              const regMatch = registeredPatients.find(
                                (p) => (q.pasien_id && p.pasien_id === q.pasien_id) || (q.nik && p.nik === q.nik)
                              );
                              const isSelected =
                                selectedRmePatient &&
                                ((q.pasien_id && selectedRmePatient.pasien_id === q.pasien_id) ||
                                  (q.nik && selectedRmePatient.nik === q.nik));

                              return (
                                <button
                                  key={q.reservasi_id || `${q.no}-${idx}`}
                                  type="button"
                                  className={`rme-patient-card ${isSelected ? 'selected' : ''}`}
                                  onClick={() =>
                                    selectPatientForRme(
                                      {
                                        pasien_id: q.pasien_id || regMatch?.pasien_id || '',
                                        nama: q.nama,
                                        nik: q.nik || regMatch?.nik || '-',
                                        no_rm: regMatch?.no_rm || '-',
                                        alamat: regMatch?.alamat || 'Kota Jambi',
                                        layanan_id: q.layanan_id
                                      },
                                      false
                                    )
                                  }
                                >
                                  <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                                    <span style={{ fontWeight: 700, color: q.status === 'DIPANGGIL' ? 'var(--color-primary)' : q.status === 'SELESAI' ? '#059669' : '#4b5563' }}>
                                      {q.no} &bull; {q.status}
                                    </span>
                                    <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>
                                      {regMatch?.no_rm || ''}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {q.nama}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {q.layanan}
                                  </div>
                                </button>
                              );
                            })
                          )
                        ) : visiblePatientCards.length === 0 ? (
                          <div style={{ padding: '1.5rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', color: '#6b7280' }}>
                            Pasien tidak ditemukan.
                          </div>
                        ) : (
                          visiblePatientCards.map((p, idx) => {
                            const isSelected = selectedRmePatient?.pasien_id === p.pasien_id;
                            return (
                              <button
                                key={p.pasien_id || idx}
                                type="button"
                                className={`rme-patient-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => selectPatientForRme(p, false)}
                              >
                                <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.15rem' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                                    {p.no_rm || `RM-${String(idx + 1).padStart(4, '0')}`}
                                  </span>
                                  <span style={{ fontFamily: 'monospace' }}>{p.nik}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.nama}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: CLEAN CLINICAL SOAP SHEET */}
                    <div className="rme-form-panel">
                      <div>
                        {/* Active Patient & Inline Service Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', marginBottom: '1.15rem', borderBottom: '1px solid #e5e7eb' }}>
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                              {selectedRmePatient ? selectedRmePatient.nama : 'Pilih Pasien di Panel Kiri'}
                            </div>
                            <div className="tabular-nums" style={{ fontSize: '0.76rem', color: '#6b7280', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                              {selectedRmePatient
                                ? `RM: ${selectedRmePatient.no_rm || '-'} • NIK: ${selectedRmePatient.nik || '-'}`
                                : 'Klik salah satu pasien dari daftar antrean untuk memulai pencatatan SOAP'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <select
                              className="dash-select"
                              style={{ width: 'auto', minWidth: '220px', padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                              value={rmeLayananId}
                              onChange={(e) => setRmeLayananId(e.target.value)}
                            >
                              <option value="">-- Layanan Pemeriksaan --</option>
                              {masterLayananList.map((l) => (
                                <option key={l.layanan_id} value={l.layanan_id}>
                                  {l.nama}{l.harga > 0 ? ` (Rp ${l.harga.toLocaleString('id-ID')})` : ''}
                                </option>
                              ))}
                            </select>

                            <span style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                              Ruang Periksa 1
                            </span>
                          </div>
                        </div>

                        {/* Compact 1-Row Vital Signs Strip */}
                        <div className="rme-vital-strip" style={{ marginBottom: '1.15rem' }}>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>Sistolik *</label>
                            <input
                              type="number"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="120"
                              value={rmeForm.tekanan_darah_sistolik}
                              onChange={(e) => setRmeForm({ ...rmeForm, tekanan_darah_sistolik: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>Diastolik *</label>
                            <input
                              type="number"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="80"
                              value={rmeForm.tekanan_darah_diastolik}
                              onChange={(e) => setRmeForm({ ...rmeForm, tekanan_darah_diastolik: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>BB (kg)</label>
                            <input
                              type="number"
                              step="0.1"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="60"
                              value={rmeForm.berat_badan}
                              onChange={(e) => setRmeForm({ ...rmeForm, berat_badan: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>UK (mgg)</label>
                            <input
                              type="text"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="28"
                              value={rmeForm.usia_kehamilan}
                              onChange={(e) => setRmeForm({ ...rmeForm, usia_kehamilan: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>TFU (cm)</label>
                            <input
                              type="number"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="24"
                              value={rmeForm.tinggi_fundus}
                              onChange={(e) => setRmeForm({ ...rmeForm, tinggi_fundus: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>DJJ (dpm)</label>
                            <input
                              type="number"
                              className="dash-input tabular-nums"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem', fontWeight: 600 }}
                              placeholder="142"
                              value={rmeForm.djj}
                              onChange={(e) => setRmeForm({ ...rmeForm, djj: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.72rem' }}>Presentasi</label>
                            <input
                              type="text"
                              className="dash-input"
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.825rem' }}
                              placeholder="Kepala"
                              value={rmeForm.presentasi}
                              onChange={(e) => setRmeForm({ ...rmeForm, presentasi: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Clean 2x2 SOAP Grid */}
                        <datalist id="rekomendasi-diagnosa-icd10">
                          <option value="Z34.8 - Pengawasan Kehamilan Normal" />
                          <option value="Z35.9 - Pengawasan Kehamilan Risiko Tinggi" />
                          <option value="O80 - Persalinan Tunggal Spontan" />
                          <option value="Z39.2 - Perawatan Masa Nifas Rutin" />
                          <option value="Z30.0 - Konseling & Pelayanan Kontrasepsi (KB)" />
                          <option value="Z76.2 - Pemantauan Tumbuh Kembang Bayi Sehat" />
                        </datalist>

                        <div className="dash-grid-2" style={{ gap: '0.85rem', marginBottom: '0.85rem' }}>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.78rem' }}>S — Subjektif (Keluhan) *</label>
                            <textarea
                              rows={2}
                              className="dash-textarea"
                              style={{ fontSize: '0.825rem', padding: '0.55rem 0.7rem' }}
                              placeholder="Keluhan pasien saat ini..."
                              value={rmeForm.keluhan}
                              onChange={(e) => setRmeForm({ ...rmeForm, keluhan: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.78rem' }}>O — Objektif (Fisik)</label>
                            <textarea
                              rows={2}
                              className="dash-textarea"
                              style={{ fontSize: '0.825rem', padding: '0.55rem 0.7rem' }}
                              placeholder="Keadaan umum, konjungtiva, edema..."
                              value={rmeForm.pemeriksaan_fisik}
                              onChange={(e) => setRmeForm({ ...rmeForm, pemeriksaan_fisik: e.target.value })}
                            />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' }}>
                              <label className="dash-label" style={{ fontSize: '0.78rem', margin: 0 }}>A — Asesmen (Diagnosa) *</label>
                              <input
                                type="text"
                                list="rekomendasi-diagnosa-icd10"
                                className="dash-input"
                                style={{ width: '165px', padding: '0.22rem 0.5rem', fontSize: '0.72rem' }}
                                placeholder="ICD-10 (opsional)"
                                value={rmeForm.kode_icd10}
                                onChange={(e) => setRmeForm({ ...rmeForm, kode_icd10: e.target.value })}
                              />
                            </div>
                            <textarea
                              rows={2}
                              className="dash-textarea"
                              style={{ fontSize: '0.825rem', padding: '0.55rem 0.7rem' }}
                              placeholder="Contoh: G2P1A0 hamil 28 minggu, janin tunggal hidup..."
                              value={rmeForm.diagnosa}
                              onChange={(e) => setRmeForm({ ...rmeForm, diagnosa: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="dash-label" style={{ fontSize: '0.78rem' }}>P — Plan (Tindakan &amp; Terapi) *</label>
                            <textarea
                              rows={2}
                              className="dash-textarea"
                              style={{ fontSize: '0.825rem', padding: '0.55rem 0.7rem' }}
                              placeholder="Rencana tindakan, aturan pakai obat, dan anjuran..."
                              value={rmeForm.tindakan_resep}
                              onChange={(e) => setRmeForm({ ...rmeForm, tindakan_resep: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Compact Medicine Adder & Protocol Bar */}
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginRight: '0.25rem' }}>
                              Resep Obat:
                            </span>
                            <select
                              className="dash-select"
                              style={{ flex: '1 1 200px', padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                              value={rmePickObatId}
                              onChange={(e) => setRmePickObatId(e.target.value)}
                            >
                              <option value="">-- Pilih Obat / Suplemen (Opsional) --</option>
                              {masterObatList.map((o) => (
                                <option key={o.obat_id} value={o.obat_id}>
                                  {o.nama_generik}{o.harga_jual > 0 ? ` — Rp ${o.harga_jual.toLocaleString('id-ID')}` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              className="dash-input tabular-nums"
                              style={{ width: '72px', padding: '0.4rem 0.5rem', fontSize: '0.78rem' }}
                              placeholder="Qty"
                              value={rmePickObatQty}
                              onChange={(e) => setRmePickObatQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                            <button
                              type="button"
                              disabled={!rmePickObatId}
                              onClick={handleAddRmeObat}
                              className="btn btn-secondary"
                              style={{ padding: '0.42rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                              + Obat
                            </button>
                          </div>

                          {rmeObatItems.length > 0 && (
                            <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {rmeObatItems.map((item) => (
                                <span
                                  key={item.obat_id}
                                  className="tabular-nums"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#111827'
                                  }}
                                >
                                  <span>
                                    {item.nama} ({item.qty}x &bull; Rp {(item.harga_satuan * item.qty).toLocaleString('id-ID')})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setRmeObatItems((prev) => prev.filter((x) => x.obat_id !== item.obat_id))}
                                    style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}
                                    aria-label="Hapus obat"
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="dash-grid-3" style={{ gap: '0.65rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                            <div>
                              <label className="dash-label" style={{ fontSize: '0.72rem' }}>Protokol Tambahan</label>
                              <select
                                className="dash-select"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                                value={rmeForm.protokol_tambahan}
                                onChange={(e) => setRmeForm({ ...rmeForm, protokol_tambahan: e.target.value })}
                              >
                                <option value="">Tidak Ada</option>
                                <option value="Edukasi Tanda Bahaya Kehamilan">Edukasi Tanda Bahaya</option>
                                <option value="Inisiasi Menyusu Dini (IMD)">Inisiasi Menyusu Dini (IMD)</option>
                                <option value="Injeksi Vitamin K1 (1 mg IM)">Injeksi Vitamin K1</option>
                                <option value="Salep Mata Antibiotik Gentamisin">Salep Mata Gentamisin</option>
                                <option value="Paket Asuhan BBL Lengkap (IMD, Vit K1, Salep Mata)">Paket BBL Lengkap</option>
                              </select>
                            </div>
                            <div>
                              <label className="dash-label" style={{ fontSize: '0.72rem' }}>Catatan Edukasi</label>
                              <input
                                type="text"
                                className="dash-input"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                                placeholder="Nutrisi, istirahat..."
                                value={rmeForm.catatan_edukasi}
                                onChange={(e) => setRmeForm({ ...rmeForm, catatan_edukasi: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="dash-label" style={{ fontSize: '0.72rem' }}>Kontrol Ulang</label>
                              <input
                                type="date"
                                className="dash-input tabular-nums"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                                value={rmeForm.tgl_kontrol_ulang}
                                onChange={(e) => setRmeForm({ ...rmeForm, tgl_kontrol_ulang: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Auto-Billing Action Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.9rem', borderTop: '1px solid #e5e7eb' }}>
                        <div className="tabular-nums" style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                          Tagihan Otomatis ke Kasir:{' '}
                          <strong style={{ color: '#111827', fontSize: '0.95rem' }}>
                            Rp {autoBillEstimate.toLocaleString('id-ID')}
                          </strong>
                        </div>

                        <button
                          type="button"
                          disabled={isSavingRme}
                          onClick={handleSaveRme}
                          className="btn btn-primary"
                          style={{ padding: '0.65rem 1.35rem', fontSize: '0.825rem', fontWeight: 700, borderRadius: '8px' }}
                        >
                          {isSavingRme ? 'Menyimpan Pemeriksaan...' : 'Simpan RME & Kirim ke Kasir'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {rmeTab === 'riwayat' && (
                <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Riwayat Pemeriksaan RME</h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Catatan pemeriksaan yang telah tersimpan.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', minWidth: '260px' }}>
                      <input
                        type="text"
                        className="dash-input"
                        placeholder="Cari nama, NIK, diagnosa..."
                        value={rmeSearchTerm}
                        onChange={(e) => { setRmeSearchTerm(e.target.value); setRmeCurrentPage(1); }}
                      />
                    </div>
                  </div>

                  {(() => {
                    const filteredRme = rmeSavedList.filter((item) => {
                      if (!rmeSearchTerm.trim()) return true;
                      const q = rmeSearchTerm.toLowerCase();
                      return (
                        item.id.toLowerCase().includes(q) ||
                        item.pasien_nama.toLowerCase().includes(q) ||
                        item.nik.toLowerCase().includes(q) ||
                        item.diagnosa.toLowerCase().includes(q) ||
                        item.tindakan.toLowerCase().includes(q)
                      );
                    });
                    const rmeTotalPages = Math.max(1, Math.ceil(filteredRme.length / 10));
                    const pagedRme = filteredRme.slice((rmeCurrentPage - 1) * 10, rmeCurrentPage * 10);

                    return (
                      <>
                        <div className="dash-table-wrap">
                          <table className="dash-table">
                            <thead>
                              <tr>
                                <th>No. Dokumen</th>
                                <th>Waktu</th>
                                <th>Nama Pasien</th>
                                <th>NIK</th>
                                <th>Tanda Vital</th>
                                <th>Diagnosa</th>
                                <th>Tindakan &amp; Resep</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedRme.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.25rem', color: '#64748b' }}>
                                    Belum ada riwayat pemeriksaan tercatat.
                                  </td>
                                </tr>
                              ) : (
                                pagedRme.map((item) => (
                                  <tr key={item.id}>
                                    <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' }}>{item.id}</td>
                                    <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{item.waktu}</td>
                                    <td style={{ fontWeight: 600 }}>{item.pasien_nama}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{item.nik}</td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                      TD: <strong>{item.tekanan_darah}</strong>
                                      {item.djj && item.djj !== '-' ? ` | DJJ: ${item.djj}` : ''}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{item.diagnosa}</td>
                                    <td style={{ color: '#475569' }}>{item.tindakan}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span>
                            Halaman {rmeCurrentPage} dari {rmeTotalPages} ({filteredRme.length} catatan)
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              disabled={rmeCurrentPage <= 1}
                              onClick={() => setRmeCurrentPage((p) => Math.max(1, p - 1))}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                            >
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={rmeCurrentPage >= rmeTotalPages}
                              onClick={() => setRmeCurrentPage((p) => Math.min(rmeTotalPages, p + 1))}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                            >
                              Selanjutnya
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              ROLE 4: PASIEN — PORTAL ANTREAN & LOKASI PRAKTIK
              ========================================================================= */}
          {currentRole === 'PASIEN' && (
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
              {pasienTab === 'tiket' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                        Halo, {localStorage.getItem('bidan_user_nama') || localStorage.getItem('bidan_pasien_nama') || 'Pasien'}
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Pantau nomor antrean aktif dan jadwal kunjungan pemeriksaan Anda.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPatientReservationModal(true)}
                      className="btn btn-primary"
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
                    >
                      + Buat Reservasi Baru
                    </button>
                  </div>

                  {(() => {
                    const loggedInNama = (localStorage.getItem('bidan_user_nama') || localStorage.getItem('bidan_pasien_nama') || '').toLowerCase().trim();
                    const loggedInUser = (localStorage.getItem('bidan_user_identifier') || '').toLowerCase().trim();
                    const loggedInPasienId = (localStorage.getItem('bidan_user_pasien_id') || '').trim();
                    const loggedInNik = (localStorage.getItem('bidan_user_nik') || '').trim();

                    let patientTicket = queueList.find((q) => {
                      const qNama = (q.nama || '').toLowerCase().trim();
                      const qPasienId = (q.pasien_id || '').trim();
                      const qNik = (q.nik || '').trim();
                      return (
                        (loggedInPasienId && qPasienId && qPasienId === loggedInPasienId) ||
                        (loggedInNik && qNik && qNik === loggedInNik) ||
                        (loggedInNama && (qNama.includes(loggedInNama) || loggedInNama.includes(qNama))) ||
                        (loggedInUser && (qNama.includes(loggedInUser) || loggedInUser.includes(qNama)))
                      );
                    });

                    if (!patientTicket) {
                      try {
                        const lastTicketRaw = localStorage.getItem('bidan_last_ticket');
                        if (lastTicketRaw) {
                          const parsed = JSON.parse(lastTicketRaw);
                          if (parsed && (parsed.nomorAntrean || parsed.no)) {
                            patientTicket = {
                              no: parsed.nomorAntrean || parsed.no,
                              nama: parsed.nama || loggedInNama,
                              layanan: parsed.layananNama || 'Pemeriksaan Kebidanan',
                              jam: parsed.estimasiJam || parsed.jam || '08:00 - 12:00 WIB',
                              tanggal: parsed.tanggal || '',
                              status: 'MENUNGGU'
                            };
                          }
                        }
                      } catch {
                        // ignore
                      }
                    }

                    if (patientTicket) {
                      return (
                        <div style={{ background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)', color: '#ffffff', borderRadius: '16px', padding: '1.75rem', marginBottom: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                                Tiket Antrean Pemeriksaan
                              </div>
                              {patientTicket.tanggal && (
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fef3c7', marginTop: '0.15rem' }}>
                                  {new Date(patientTicket.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 800 }}>
                              {patientTicket.status || 'MENUNGGU'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Nomor Antrean</div>
                              <div style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1.05 }}>{patientTicket.no}</div>
                              <div style={{ fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.92 }}>
                                Layanan: {patientTicket.layanan}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Estimasi Sesi</div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{patientTicket.jam}</div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{KLINIK_INFO.bidan}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="dash-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                          Belum Ada Antrean Aktif
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
                          Buat reservasi kunjungan terlebih dahulu untuk mendapatkan nomor antrean terjadwal.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowPatientReservationModal(true)}
                          className="btn btn-primary"
                          style={{ padding: '0.65rem 1.35rem', fontSize: '0.875rem' }}
                        >
                          Buat Reservasi Sekarang
                        </button>
                      </div>
                    );
                  })()}

                  <div className="dash-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem' }}>
                      Informasi Kunjungan Klinik
                    </h3>
                    <div className="dash-grid-3" style={{ marginBottom: '1rem' }}>
                      <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Status Akun</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>Pasien Terdaftar</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Jam Praktik Reguler</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#16a34a', marginTop: '0.15rem' }}>08:00 - 12:00 &amp; 16:00 - 20:00</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Bidan Praktik</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{KLINIK_INFO.bidan}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                      Demi kerahasiaan medis, dokumen rekam medis pemeriksaan hanya diakses oleh tenaga kesehatan berwenang di klinik. Harap hadir 15 menit sebelum sesi dimulai.
                    </p>
                  </div>
                </div>
              )}

              {(pasienTab === 'lokasi' || pasienTab === 'tiket') && (
                <div className="dash-card" style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Lokasi Praktik &amp; Petunjuk Arah</h3>
                      <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.2rem', maxWidth: '520px' }}>
                        {KLINIK_INFO.alamat}
                      </p>
                    </div>
                    <a
                      href={KLINIK_INFO.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 0.95rem', fontSize: '0.8125rem' }}
                    >
                      Buka Rute Google Maps &rarr;
                    </a>
                  </div>
                  <div style={{ width: '100%', height: '220px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
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
              )}

              <ReservationModal
                isOpen={showPatientReservationModal}
                onClose={() => {
                  setShowPatientReservationModal(false);
                  refreshReservasi();
                  refreshKeuanganDanTagihan();
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* Modal: Penyesuaian Harga Obat */}
      {showAddHargaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="dash-card" style={{ maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Penyesuaian Harga Jual Obat
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.15rem' }}>
              Perbarui harga satuan obat untuk perhitungan tagihan pasien.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setHargaError(null);
                if (!newHargaItem.obat_id) {
                  setHargaError('Pilih obat terlebih dahulu.');
                  return;
                }
                if (!Number.isFinite(newHargaItem.harga_jual) || newHargaItem.harga_jual <= 0) {
                  setHargaError('Harga jual harus lebih dari Rp 0.');
                  return;
                }
                if (newHargaItem.alasan.trim().length < 3) {
                  setHargaError('Keterangan minimal 3 karakter.');
                  return;
                }
                setHargaSaving(true);
                try {
                  await apiClient.put(`/harga/OBAT/${newHargaItem.obat_id}`, {
                    harga: newHargaItem.harga_jual,
                    alasan: newHargaItem.alasan.trim(),
                    berlaku_dari: new Date().toISOString().split('T')[0] || undefined
                  });
                  setShowAddHargaModal(false);
                  setNewHargaItem({ obat_id: '', nama_obat: '', kategori: '', harga_jual: 0, alasan: '' });
                  setReloadHarga((v) => v + 1);
                  notify('Harga jual obat berhasil diperbarui.', 'success');
                } catch (err: unknown) {
                  setHargaError(pesanErrorApi(err, 'Gagal menyimpan harga obat.'));
                } finally {
                  setHargaSaving(false);
                }
              }}
            >
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="dash-label">Pilih Obat / Alkes</label>
                <select
                  required
                  className="dash-select"
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
                >
                  <option value="">-- Pilih Obat --</option>
                  {obatOptions.map((o) => (
                    <option key={o.obat_id} value={o.obat_id}>
                      {o.nama_obat}{o.kode ? ` (${o.kode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="dash-label">Harga Jual Baru (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  className="dash-input"
                  value={newHargaItem.harga_jual || ''}
                  onChange={(e) => setNewHargaItem({ ...newHargaItem, harga_jual: Number(e.target.value) })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="dash-label">Alasan Penyesuaian</label>
                <textarea
                  rows={2}
                  required
                  className="dash-textarea"
                  placeholder="Contoh: Penyesuaian harga pengadaan distributor"
                  value={newHargaItem.alasan}
                  onChange={(e) => setNewHargaItem({ ...newHargaItem, alasan: e.target.value })}
                />
              </div>

              {hargaError && (
                <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.8rem', fontWeight: 600 }}>
                  {hargaError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddHargaModal(false)} className="btn btn-secondary" disabled={hargaSaving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={hargaSaving}>
                  {hargaSaving ? 'Menyimpan...' : 'Simpan Harga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Item Inventaris */}
      {showAddAlkesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="dash-card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Tambah Obat / Alkes Baru
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.15rem' }}>
              Tambahkan item medis baru ke dalam daftar inventaris klinik.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAlkesSaving(true);
                const kode = newAlkesItem.kode || `ALK-${Date.now().toString().slice(-4)}`;
                try {
                  await apiClient.post('/inventaris', {
                    kode,
                    nama_generik: newAlkesItem.nama_generik,
                    nama_dagang: newAlkesItem.nama_generik,
                    kategori: newAlkesItem.kategori,
                    bentuk: newAlkesItem.bentuk,
                    satuan: newAlkesItem.satuan,
                    stok_minimum: Number(newAlkesItem.stok_minimum) || 5,
                    stok_awal: Number(newAlkesItem.stok_total) || 0
                  });
                  const refetch = await apiClient.post('/inventaris/list', {});
                  if (refetch.data?.data && Array.isArray(refetch.data.data)) {
                    setStokAlkes(
                      refetch.data.data.map((o: any) => ({
                        obat_id: o.obat_id,
                        kode: o.kode || o.obat_id,
                        nama: o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : o.nama_generik || 'Obat',
                        kategori: o.kategori || 'Farmasi',
                        stok: Number(o.stok_total || 0),
                        min: Number(o.stok_minimum || 10),
                        satuan: o.satuan || 'Pcs',
                        status: Number(o.stok_total || 0) <= Number(o.stok_minimum || 10) ? 'MENIPIS' : 'AMAN'
                      }))
                    );
                  }
                  setReloadHarga((v) => v + 1);
                  notify(`Item "${newAlkesItem.nama_generik}" berhasil ditambahkan.`, 'success');
                  setShowAddAlkesModal(false);
                  setNewAlkesItem({ kode: '', nama_generik: '', kategori: 'ALKES', bentuk: 'Pcs', satuan: 'pcs', stok_total: 20, stok_minimum: 5 });
                } catch (err) {
                  notify(pesanErrorApi(err, 'Gagal menambahkan item inventaris.'), 'error');
                } finally {
                  setAlkesSaving(false);
                }
              }}
            >
              <div className="dash-grid-2" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <label className="dash-label">Kode Item</label>
                  <input
                    type="text"
                    className="dash-input"
                    placeholder="ALK-012"
                    value={newAlkesItem.kode}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, kode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="dash-label">Nama Obat / Alkes *</label>
                  <input
                    type="text"
                    required
                    className="dash-input"
                    placeholder="Contoh: Oksitosin 10 IU"
                    value={newAlkesItem.nama_generik}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, nama_generik: e.target.value })}
                  />
                </div>
              </div>

              <div className="dash-grid-3" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <label className="dash-label">Kategori</label>
                  <select
                    className="dash-select"
                    value={newAlkesItem.kategori}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, kategori: e.target.value })}
                  >
                    <option value="ALKES">ALKES</option>
                    <option value="OBAT_KERAS">OBAT KERAS</option>
                    <option value="OBAT_BEBAS">OBAT BEBAS</option>
                    <option value="SUPLEMEN">SUPLEMEN</option>
                    <option value="VAKSIN">VAKSIN</option>
                  </select>
                </div>
                <div>
                  <label className="dash-label">Bentuk</label>
                  <input
                    type="text"
                    className="dash-input"
                    value={newAlkesItem.bentuk}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, bentuk: e.target.value })}
                  />
                </div>
                <div>
                  <label className="dash-label">Satuan</label>
                  <input
                    type="text"
                    className="dash-input"
                    value={newAlkesItem.satuan}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, satuan: e.target.value })}
                  />
                </div>
              </div>

              <div className="dash-grid-2" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <label className="dash-label">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    className="dash-input"
                    value={newAlkesItem.stok_total}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, stok_total: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="dash-label">Batas Minimum</label>
                  <input
                    type="number"
                    min="1"
                    className="dash-input"
                    value={newAlkesItem.stok_minimum}
                    onChange={(e) => setNewAlkesItem({ ...newAlkesItem, stok_minimum: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddAlkesModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={alkesSaving} className="btn btn-primary">
                  {alkesSaving ? 'Menyimpan...' : 'Simpan Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Mutasi Stok */}
      {showMutasiStokModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="dash-card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Catat Mutasi Stok
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.15rem' }}>
              Catat penambahan stok masuk atau pengurangan pemakaian item medis.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!mutasiForm.obat_id) {
                  notify('Pilih item obat atau alkes terlebih dahulu.', 'error');
                  return;
                }
                setMutasiSaving(true);
                try {
                  await apiClient.post(`/inventaris/${mutasiForm.obat_id}/restock`, {
                    jumlah: Number(mutasiForm.jumlah),
                    jenis: mutasiForm.jenis,
                    no_batch: mutasiForm.no_batch || `MUT-${Date.now().toString().slice(-6)}`,
                    keterangan: mutasiForm.keterangan || (mutasiForm.jenis === 'MASUK' ? 'Penerimaan stok' : 'Pemakaian tindakan')
                  });
                  const refetch = await apiClient.post('/inventaris/list', {});
                  if (refetch.data?.data && Array.isArray(refetch.data.data)) {
                    setStokAlkes(
                      refetch.data.data.map((o: any) => ({
                        obat_id: o.obat_id,
                        kode: o.kode || o.obat_id,
                        nama: o.nama_dagang ? `${o.nama_dagang} (${o.nama_generik})` : o.nama_generik || 'Obat',
                        kategori: o.kategori || 'Farmasi',
                        stok: Number(o.stok_total || 0),
                        min: Number(o.stok_minimum || 10),
                        satuan: o.satuan || 'Pcs',
                        status: Number(o.stok_total || 0) <= Number(o.stok_minimum || 10) ? 'MENIPIS' : 'AMAN'
                      }))
                    );
                  }
                  notify(`Mutasi stok (${mutasiForm.jenis}) sebanyak ${mutasiForm.jumlah} unit berhasil disimpan.`, 'success');
                  setShowMutasiStokModal(false);
                  setMutasiForm({ obat_id: stokAlkes[0]?.obat_id || '', jenis: 'MASUK', jumlah: 10, no_batch: '', keterangan: '' });
                } catch (err) {
                  notify(pesanErrorApi(err, 'Gagal mencatat mutasi stok.'), 'error');
                } finally {
                  setMutasiSaving(false);
                }
              }}
            >
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="dash-label">Pilih Obat / Alkes *</label>
                <select
                  required
                  className="dash-select"
                  value={mutasiForm.obat_id}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, obat_id: e.target.value })}
                >
                  <option value="">-- Pilih Item --</option>
                  {stokAlkes.map((s) => (
                    <option key={s.obat_id || s.kode} value={s.obat_id || s.kode}>
                      {s.kode} — {s.nama} (Stok: {s.stok} {s.satuan})
                    </option>
                  ))}
                </select>
              </div>

              <div className="dash-grid-2" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <label className="dash-label">Jenis Mutasi *</label>
                  <select
                    className="dash-select"
                    value={mutasiForm.jenis}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, jenis: e.target.value as 'MASUK' | 'KELUAR' })}
                  >
                    <option value="MASUK">Stok Masuk (Penerimaan)</option>
                    <option value="KELUAR">Stok Keluar (Pemakaian)</option>
                  </select>
                </div>
                <div>
                  <label className="dash-label">Jumlah Unit *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    className="dash-input"
                    value={mutasiForm.jumlah}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, jumlah: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="dash-label">Nomor Batch (Opsional)</label>
                <input
                  type="text"
                  className="dash-input"
                  placeholder="Contoh: LOT-2026-01"
                  value={mutasiForm.no_batch}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, no_batch: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="dash-label">Keterangan *</label>
                <textarea
                  rows={2}
                  required
                  className="dash-textarea"
                  placeholder="Alasan penambahan atau pemakaian stok..."
                  value={mutasiForm.keterangan}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, keterangan: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowMutasiStokModal(false)} className="btn btn-secondary" disabled={mutasiSaving}>
                  Batal
                </button>
                <button type="submit" disabled={mutasiSaving} className="btn btn-primary">
                  {mutasiSaving ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Koreksi / Tagihan Manual (Opsional di Kasir) */}
      {showCreateBillingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="dash-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Koreksi / Tambah Tagihan Manual</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Gunakan bila ada penyesuaian item layanan atau obat tambahan di luar tagihan otomatis.
                </p>
              </div>
              <button type="button" onClick={() => setShowCreateBillingModal(false)} style={{ fontSize: '1.25rem', color: '#64748b' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveBilling}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="dash-label">Pilih Pasien *</label>
                <select
                  required
                  className="dash-select"
                  value={billingPatientId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setBillingPatientId(pid);
                    const pMatch = registeredPatients.find((p) => p.pasien_id === pid);
                    const qMatch = queueList.find((q) => q.pasien_id === pid);
                    setBillingPatientNama(qMatch?.nama || pMatch?.nama || 'Pasien');
                  }}
                >
                  <option value="">-- Pilih Pasien --</option>
                  {registeredPatients.map((p) => (
                    <option key={p.pasien_id} value={p.pasien_id}>
                      {p.nama} (RM: {p.no_rm} | NIK: {p.nik})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="dash-label">Tambah Layanan Medis</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="dash-select"
                    style={{ flex: '1 1 200px' }}
                    value={selectedLayananId}
                    onChange={(e) => setSelectedLayananId(e.target.value)}
                  >
                    <option value="">-- Pilih Layanan --</option>
                    {masterLayananList.map((l) => (
                      <option key={l.layanan_id} value={l.layanan_id}>
                        {l.nama} — Rp {Number(l.harga).toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={handleAddLayananItem} disabled={!selectedLayananId} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}>
                    + Tambah
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="dash-label">Tambah Obat / Alkes</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="dash-select"
                    style={{ flex: '1 1 200px' }}
                    value={selectedObatId}
                    onChange={(e) => setSelectedObatId(e.target.value)}
                  >
                    <option value="">-- Pilih Obat --</option>
                    {masterObatList.map((o) => (
                      <option key={o.obat_id} value={o.obat_id}>
                        {o.nama_generik} — Rp {Number(o.harga_jual).toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className="dash-input"
                    style={{ width: '80px' }}
                    value={selectedObatQty}
                    onChange={(e) => setSelectedObatQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  <button type="button" onClick={handleAddObatItem} disabled={!selectedObatId} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}>
                    + Tambah
                  </button>
                </div>
              </div>

              {billingItems.length > 0 && (
                <div className="dash-table-wrap" style={{ marginBottom: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                        <th style={{ textAlign: 'center' }}>Hapus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingItems.map((it) => (
                        <tr key={it.id}>
                          <td style={{ fontWeight: 600 }}>{it.nama}</td>
                          <td>{it.qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>Rp {it.subtotal.toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setBillingItems((prev) => prev.filter((x) => x.id !== it.id))}
                              style={{ color: '#dc2626', fontWeight: 700 }}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Total Tambahan</span>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-primary-dark)' }}>
                  Rp {billingItems.reduce((acc, it) => acc + it.subtotal, 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateBillingModal(false)} className="btn btn-secondary" disabled={billingSubmitting}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={billingSubmitting || billingItems.length === 0}>
                  {billingSubmitting ? 'Menyimpan...' : 'Simpan Tagihan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pratinjau Email Pasien */}
      {previewEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="dash-card" style={{ maxWidth: '540px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{previewEmail.subjek}</h4>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Kepada: {previewEmail.pasien_nama} ({previewEmail.email_tujuan})
                </div>
              </div>
              <button type="button" onClick={() => setPreviewEmail(null)} style={{ fontSize: '1.25rem', color: '#64748b' }}>&times;</button>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <p style={{ marginBottom: '0.65rem' }}>Yth. <strong>{previewEmail.pasien_nama}</strong>,</p>
              <p style={{ marginBottom: '0.65rem' }}>
                Terima kasih telah melakukan pendaftaran layanan di <strong>{KLINIK_INFO.nama}</strong>. Silakan hadir sesuai jadwal sesi yang telah dipilih.
              </p>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Alamat: {KLINIK_INFO.alamat} | Telepon: {KLINIK_INFO.telepon}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPreviewEmail(null)} className="btn btn-primary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

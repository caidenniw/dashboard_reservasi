/*
 * Peta modul untuk halaman Beranda (peluncur menu, bukan panel informasi).
 * Key mengacu ke kunci leaf di config/menu — ikon/label/href diambil dari sana
 * lewat modulMenu(), visibilitas peran pakai menuTampil() seperti sidebar.
 */

export interface KartuModul {
    key: string;
    judul: string;
    desc: string;
}

export interface SeksiModul {
    seksi: string;
    kartu: KartuModul[];
}

export const PETA_MODUL: SeksiModul[] = [
    {
        seksi: "Operasional Inti",
        kartu: [
            {
                key: "input",
                judul: "Input Pesanan",
                desc: "Buat pesanan baru lewat form terstruktur atau tempel teks pesanan.",
            },
            {
                key: "data",
                judul: "Pesanan & Faktur",
                desc: "Semua pesanan, invoice, status siklus hidup, dan pembayaran.",
            },
            {
                key: "ketersediaan",
                judul: "Ketersediaan Unit",
                desc: "Papan jadwal unit & driver untuk hari-hari ke depan.",
            },
            {
                key: "laporan",
                judul: "Laporan Penjualan",
                desc: "Grafik tren, rekap per armada/kota, dan cetak laporan.",
            },
        ],
    },
    {
        seksi: "Keuangan",
        kartu: [
            { key: "arus_kas", judul: "Arus Kas", desc: "Riwayat pembayaran masuk dari pelanggan." },
            { key: "piutang", judul: "Piutang Pelanggan", desc: "Invoice belum lunas dan kirim pengingat WA." },
        ],
    },
    {
        seksi: "Data Master",
        kartu: [
            { key: "unit", judul: "Armada Mobil", desc: "Unit, nopol, jenis, tarif, dan kelengkapan kendaraan." },
            { key: "driver", judul: "Data Driver", desc: "Profil driver, jenjang, dan ketersediaan tugas." },
            { key: "customer", judul: "Data Pelanggan", desc: "Perorangan dan perusahaan beserta riwayat pesanan." },
            { key: "partner", judul: "Vendor (Support By)", desc: "Mitra pendukung operasional dan catatan kerja sama." },
            { key: "wilayah", judul: "Master Wilayah", desc: "Area layanan dalam kota dan luar kota." },
            { key: "kota", judul: "Master Kota", desc: "Kota tujuan untuk rute, laporan, dan tarif." },
            { key: "include", judul: "Item Include", desc: "Daftar perlengkapan yang ikut pada setiap sewa." },
        ],
    },
    {
        seksi: "Sistem & Tools",
        kartu: [
            { key: "asisten", judul: "Asisten Data", desc: "Ekstrak data pesanan dari teks bebas secara otomatis." },
            { key: "import_xlsx", judul: "Import Excel", desc: "Massal impor orderan dari berkas Excel." },
            { key: "import", judul: "Import CSV", desc: "Impor data mentah dari ekspor CSV lama." },
            { key: "pengaturan", judul: "Pengaturan Faktur", desc: "Nomor, kop, dan format invoice perusahaan." },
            { key: "manajemen_user", judul: "Manajemen User", desc: "Akun, peran, dan hak akses sistem." },
            { key: "ubah_password", judul: "Ubah Password", desc: "Perbarui kata sandi akun yang sedang masuk." },
        ],
    },
];

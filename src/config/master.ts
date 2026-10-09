/*
 * Konfigurasi halaman MASTER — SALINAN dari config/master.php.
 * Semua label, tipe kolom, urutan, aturan wajib, dan teks bantuan diambil apa
 * adanya supaya tampilan & perilaku sama.
 */

export type TipeKolom =
    | "text" | "select" | "number" | "rupiah" | "tel" | "textarea" | "foto" | "date";

export interface OpsiSql {
    from: string;
    value: string;
    label: string;
    where?: string;
    order?: string;
}

export interface KolomMaster {
    name: string;
    label: string;
    tipe: TipeKolom;
    wajib?: boolean;
    help?: string;
    lebar?: string;
    max?: number;
    opsi?: Record<string, string>;
    opsi_sql?: OpsiSql;
}

export interface CfgMaster {
    tabel: string;
    judul: string;
    judul_halaman: string;
    menu: string;
    soft_delete?: boolean;
    order?: string;
    cari_kolom?: string[];
    placeholder?: string;
    kolom: KolomMaster[];
    kolom_list: string[];
    status_map?: Record<string, string>;
    warna_status?: Record<string, string>;
}

export const MASTER: Record<string, CfgMaster> = {
    /* ======================= ARMADA MOBIL (units) ======================= */
    armada: {
        tabel: "units",
        judul: "Unit",
        judul_halaman: "Armada Mobil",
        menu: "unit",
        soft_delete: true,
        order: "nama_unit",
        cari_kolom: ["nama_unit", "nopol", "kode_unit", "merek"],
        placeholder: "cari nama / nopol / kode",
        kolom: [
            { name: "kode_unit", label: "Kode Unit", tipe: "text", help: "opsional, misal INV-01" },
            { name: "nama_unit", label: "Nama Unit", tipe: "text", wajib: true, help: "contoh: Innova Reborn" },
            { name: "nopol", label: "Nomor Polisi", tipe: "text", wajib: true, help: "contoh: BK 1507 LIN" },
            {
                name: "jenis", label: "Jenis", tipe: "select",
                opsi: { MPV: "MPV", SUV: "SUV", Hiace: "Hiace", Bus: "Bus", Sedan: "Sedan", Pickup: "Pickup", Lain: "Lain" },
            },
            { name: "tahun", label: "Tahun", tipe: "number" },
            {
                name: "transmisi", label: "Transmisi", tipe: "select",
                opsi: { "": "-- pilih --", manual: "Manual", matic: "Matic" },
            },
            { name: "kapasitas", label: "Kapasitas (orang)", tipe: "number" },
            {
                name: "pemilik", label: "Pemilik", tipe: "select",
                opsi: { sendiri: "Milik sendiri", partner: "Vendor" },
            },
            {
                name: "partner_id", label: "Partner", tipe: "select",
                opsi_sql: { from: "partners WHERE deleted_at IS NULL", value: "id", label: "nama" },
            },
            { name: "harga_modal_default", label: "Harga Modal / Hari", tipe: "rupiah", help: "internal - tidak muncul di invoice customer" },
            { name: "harga_jual_default", label: "Harga Jual / Hari", tipe: "rupiah" },
            {
                name: "status", label: "Status", tipe: "select",
                opsi: { ready: "Siap", keluar: "Sedang Keluar", maintenance: "Perawatan", nonaktif: "Nonaktif" },
            },
            { name: "catatan", label: "Catatan", tipe: "textarea", lebar: "col-12" },
        ],
        kolom_list: ["nama_unit", "nopol", "jenis", "pemilik", "harga_modal_default", "harga_jual_default", "status"],
        status_map: { ready: "Siap", keluar: "Sedang Keluar", maintenance: "Perawatan", nonaktif: "Nonaktif" },
    },

    /* =========================== DRIVER (drivers) ======================= */
    driver: {
        tabel: "drivers",
        judul: "Driver",
        judul_halaman: "Data Driver",
        menu: "driver",
        soft_delete: true,
        order: "nama",
        cari_kolom: ["nama", "hp", "wilayah", "nomor_sim"],
        placeholder: "cari nama / HP / wilayah",
        kolom: [
            { name: "nama", label: "Nama Driver", tipe: "text", wajib: true },
            {
                name: "jenjang", label: "Jenjang Driver", tipe: "select",
                opsi: {
                    "": "-- pilih --", Traine: "Traine (masih belajar)", Pratama: "Pratama (dasar)",
                    Madya: "Madya (menengah)", Utama: "Utama (senior)",
                },
                help: "Urutan jenjang: Traine < Pratama < Madya < Utama",
            },
            { name: "foto", label: "Foto Driver", tipe: "foto", help: "JPG/PNG, maksimal 2 MB. Muncul di daftar driver dan halaman trip driver." },
            { name: "hp", label: "HP / WA", tipe: "tel", help: "08xx atau +62xx (otomatis dirapikan)" },
            { name: "wilayah", label: "Wilayah", tipe: "text", help: "contoh: Gunung Sitoli / Medan" },
            { name: "nomor_sim", label: "Nomor SIM", tipe: "text" },
            { name: "bank", label: "Bank", tipe: "text" },
            { name: "no_rekening", label: "No. Rekening", tipe: "text" },
            {
                name: "status", label: "Status", tipe: "select",
                opsi: { aktif: "Aktif", izin: "Izin", sakit: "Sakit", nonaktif: "Nonaktif" },
            },
            { name: "catatan", label: "Catatan", tipe: "textarea", lebar: "col-12" },
        ],
        kolom_list: ["foto", "nama", "jenjang", "hp", "wilayah", "status"],
        status_map: { aktif: "Aktif", izin: "Izin", sakit: "Sakit", nonaktif: "Nonaktif" },
    },

    /* ========================= CUSTOMER (customers) ===================== */
    pelanggan: {
        tabel: "customers",
        judul: "Customer",
        judul_halaman: "Data Pelanggan",
        menu: "customer",
        soft_delete: true,
        order: "nama_pesanan",
        cari_kolom: ["nama_pesanan", "nama_pic", "hp_pic", "alamat"],
        placeholder: "cari nama pesanan / PIC / HP",
        kolom: [
            { name: "nama_pesanan", label: "Nama Pesanan / Instansi", tipe: "text", wajib: true, lebar: "col-md-6" },
            {
                name: "tipe", label: "Tipe", tipe: "select",
                opsi: { perorangan: "Perorangan", perusahaan: "Perusahaan", instansi: "Instansi", RO: "Repeat Order" },
            },
            { name: "nama_pic", label: "Nama PIC", tipe: "text" },
            { name: "hp_pic", label: "HP / WA PIC", tipe: "tel" },
            { name: "email", label: "Email", tipe: "text" },
            {
                name: "sumber", label: "Sumber Order", tipe: "select",
                opsi: {
                    wa: "WhatsApp", telepon: "Telepon", instagram: "Instagram", tiktok: "TikTok",
                    facebook: "Facebook", website: "Website", referral: "Referral", lainnya: "Lainnya",
                },
            },
            {
                name: "status", label: "Status Customer", tipe: "select",
                opsi: { baru: "Baru", tetap: "Tetap", RO: "Repeat Order" },
            },
            { name: "alamat", label: "Alamat", tipe: "text", lebar: "col-12" },
            { name: "catatan", label: "Catatan", tipe: "textarea", lebar: "col-12" },
        ],
        kolom_list: ["nama_pesanan", "tipe", "nama_pic", "hp_pic", "sumber", "status"],
    },

    /* ========================== PARTNER -> VENDOR (partners) ============ */
    partner: {
        tabel: "partners",
        judul: "Vendor",
        judul_halaman: "Vendor",
        menu: "partner",
        soft_delete: true,
        order: "nama",
        cari_kolom: ["nama", "hp", "alamat"],
        placeholder: "cari nama vendor / HP",
        kolom: [
            { name: "nama", label: "Nama Vendor", tipe: "text", wajib: true, help: "contoh: Om Karius" },
            {
                name: "tipe", label: "Tipe", tipe: "select",
                opsi: { vendor: "Vendor unit", perantara: "Perantara", owner_unit: "Pemilik unit" },
            },
            {
                name: "status", label: "Status Vendor", tipe: "select",
                opsi: {
                    normal: "Normal", warning: "Warning (perhatian)",
                    danger: "Danger (bermasalah)", blacklist: "Blacklist (jangan dipakai)",
                },
            },
            {
                name: "wilayah_id", label: "Wilayah", tipe: "select",
                opsi_sql: { from: "wilayah WHERE deleted_at IS NULL", value: "id", label: "nama" },
            },
            {
                name: "kota_id", label: "Kota", tipe: "select",
                opsi_sql: { from: "kota WHERE deleted_at IS NULL", value: "id", label: "nama" },
            },
            { name: "hp", label: "HP / WA", tipe: "tel" },
            { name: "bank", label: "Bank", tipe: "text" },
            { name: "no_rekening", label: "No. Rekening", tipe: "text" },
            { name: "alamat", label: "Alamat", tipe: "text", lebar: "col-12" },
            { name: "catatan", label: "Catatan", tipe: "textarea", lebar: "col-12" },
        ],
        kolom_list: ["nama", "tipe", "status", "hp", "bank"],
        status_map: { normal: "Normal", warning: "Warning", danger: "Danger", blacklist: "Blacklist" },
        warna_status: { normal: "success", warning: "warning", danger: "danger", blacklist: "dark" },
    },

    /* ===================== MASTER WILAYAH (wilayah) ===================== */
    wilayah: {
        tabel: "wilayah",
        judul: "Wilayah",
        judul_halaman: "Master Wilayah",
        menu: "wilayah",
        soft_delete: true,
        order: "urutan",
        cari_kolom: ["nama", "keterangan"],
        placeholder: "cari nama wilayah",
        kolom: [
            { name: "nama", label: "Nama Wilayah", tipe: "text", wajib: true, help: "contoh: Dalam Kota Medan" },
            { name: "keterangan", label: "Keterangan", tipe: "text", lebar: "col-12" },
            { name: "urutan", label: "Urutan Tampil", tipe: "number" },
        ],
        kolom_list: ["nama", "keterangan", "urutan"],
    },

    /* ======================= MASTER KOTA (kota) ========================= */
    kota: {
        tabel: "kota",
        judul: "Kota",
        judul_halaman: "Master Kota",
        menu: "kota",
        soft_delete: true,
        order: "urutan",
        cari_kolom: ["nama", "keterangan"],
        placeholder: "cari nama kota",
        kolom: [
            { name: "nama", label: "Nama Kota", tipe: "text", wajib: true, help: "contoh: Medan" },
            {
                name: "wilayah_id", label: "Wilayah", tipe: "select",
                opsi_sql: { from: "wilayah WHERE deleted_at IS NULL", value: "id", label: "nama" },
            },
            { name: "urutan", label: "Urutan Tampil", tipe: "number" },
            { name: "keterangan", label: "Keterangan", tipe: "text", lebar: "col-12" },
        ],
        kolom_list: ["nama", "wilayah_id", "urutan"],
    },

    /* ====================== ITEM INCLUDE (includes) ===================== */
    /* include tidak punya kolom deleted_at -> dihapus permanen. */
    include: {
        tabel: "includes",
        judul: "Item Include",
        judul_halaman: "Item Include",
        menu: "include",
        order: "urutan",
        cari_kolom: ["nama"],
        placeholder: "cari nama include",
        kolom: [
            { name: "nama", label: "Nama Include", tipe: "text", wajib: true, help: "contoh: BBM, Parkir, Tol" },
            { name: "urutan", label: "Urutan Tampil", tipe: "number" },
            {
                name: "is_default", label: "Terpilih otomatis di form?", tipe: "select",
                opsi: { "0": "Tidak", "1": "Ya" },
            },
        ],
        kolom_list: ["nama", "urutan", "is_default"],
    },
};

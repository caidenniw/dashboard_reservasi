/*
 * Peta rute -> judul halaman & kunci menu sidebar.
 * Menggantikan @section('judul') dan @section('menu') pada layout Blade.
 */

export interface MetaRute {
    judul: string;
    menu: string;
}

const MASTER: Record<string, MetaRute> = {
    armada: { judul: "Armada Mobil", menu: "unit" },
    driver: { judul: "Data Driver", menu: "driver" },
    pelanggan: { judul: "Data Pelanggan", menu: "customer" },
    partner: { judul: "Vendor", menu: "partner" },
    wilayah: { judul: "Master Wilayah", menu: "wilayah" },
    kota: { judul: "Master Kota", menu: "kota" },
    include: { judul: "Item Include", menu: "include" },
};

export function metaRute(pathname: string): MetaRute {
    const p = pathname.replace(/\/+$/, "") || "/";

    if (p === "/") {
        return { judul: "Peta Modul", menu: "beranda" };
    }
    if (p === "/ketersediaan") {
        return { judul: "Ketersediaan Unit & Driver", menu: "ketersediaan" };
    }
    if (p === "/pesanan/baru") {
        return { judul: "Input Pesanan Baru", menu: "input" };
    }
    if (p === "/pesanan") {
        return { judul: "Data Pesanan & Faktur", menu: "data" };
    }
    if (p.startsWith("/pesanan/")) {
        if (p.endsWith("/ubah")) {
            return { judul: "Ubah Pesanan", menu: "input" };
        }
        if (p.endsWith("/bukti")) {
            return { judul: "Bukti Pembayaran", menu: "data" };
        }
        if (p.endsWith("/teks-wa")) {
            return { judul: "Teks WhatsApp", menu: "data" };
        }
        return { judul: "Detail Pesanan", menu: "data" };
    }
    if (p.startsWith("/master/")) {
        const slug = p.split("/")[2] ?? "";
        return MASTER[slug] ?? { judul: "Master", menu: "unit" };
    }
    if (p.startsWith("/asisten")) {
        return { judul: "Asisten Data", menu: "asisten" };
    }
    if (p.startsWith("/import/excel")) {
        return { judul: "Import Excel (Orderan)", menu: "import_xlsx" };
    }
    if (p.startsWith("/import")) {
        return { judul: "Import CSV", menu: "import" };
    }
    if (p.startsWith("/pengaturan")) {
        return { judul: "Pengaturan Faktur", menu: "pengaturan" };
    }
    if (p.startsWith("/keuangan/arus-kas")) {
        return { judul: "Arus Kas", menu: "arus_kas" };
    }
    if (p.startsWith("/keuangan/piutang")) {
        return { judul: "Piutang Pelanggan", menu: "piutang" };
    }
    if (p.startsWith("/laporan/audit")) {
        return { judul: "Audit Log", menu: "audit" };
    }
    if (p.startsWith("/laporan/driver")) {
        return { judul: "Detail Trip Driver", menu: "laporan" };
    }
    if (p.startsWith("/laporan")) {
        return { judul: "Laporan Penjualan", menu: "laporan" };
    }
    if (p.startsWith("/user")) {
        return { judul: "Manajemen User", menu: "manajemen_user" };
    }
    if (p.startsWith("/profil")) {
        return { judul: "Ubah Password", menu: "ubah_password" };
    }
    if (p.startsWith("/invoice")) {
        return { judul: "Invoice", menu: "data" };
    }
    return { judul: "Beranda", menu: "beranda" };
}

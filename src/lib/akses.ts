/*
 * Peta HAK AKSES terpusat — port 1:1 dari app/Support/Akses.php.
 *
 * PERAN:
 * - superadmin : semua boleh, termasuk modal/margin/laba, pengaturan, import, kelola user.
 * - reservasi  : input & ubah pesanan, terbitkan invoice, cetak SEMENTARA.
 *                TIDAK melihat modal/margin, TIDAK cetak final, TIDAK kelola user/pengaturan/import.
 * - finance    : hanya cetak invoice FINAL + catat pembayaran, serta melihat data pesanan.
 *                TIDAK boleh input/ubah pesanan.
 */

export type Role = "superadmin" | "reservasi" | "finance";

export const DAFTAR_ROLE: Record<Role, string> = {
    superadmin: "Super Admin (Owner)",
    reservasi: "Admin Reservasi",
    finance: "Finance",
};

const RESERVASI: string[] = [
    "beranda", "pesanan.lihat", "pesanan.tulis",
    "invoice.terbit", "invoice.cetak_sementara",
    "master.lihat", "profil", "laporan",
    "asisten",
];

const FINANCE: string[] = [
    "beranda", "pesanan.lihat",
    "invoice.cetak_final", "keuangan.bayar", "profil", "laporan", "laporan.semua",
];

const SEMUA: string[] = [
    "beranda", "pesanan.lihat", "pesanan.tulis", "pesanan.hapus",
    "invoice.terbit", "invoice.cetak_sementara", "invoice.cetak_final",
    "keuangan.bayar", "master.lihat", "master.tulis", "import",
    "pengaturan", "user.kelola", "asisten", "lihat_modal", "profil",
    "laporan", "laporan.semua", "audit.lihat",
];

export const PETA_AKSES: Record<Role, string[]> = {
    superadmin: SEMUA,
    reservasi: RESERVASI,
    finance: FINANCE,
};

/** Apakah peran tertentu punya kemampuan tertentu? */
export function roleBoleh(role: Role, kemampuan: string): boolean {
    return (PETA_AKSES[role] ?? []).includes(kemampuan);
}

/** Normalisasi nilai role dari DB; default 'reservasi' bila tak dikenal. */
export function normalisasiRole(nilai: unknown): Role {
    const r = String(nilai ?? "");
    if (r === "superadmin" || r === "reservasi" || r === "finance") {
        return r;
    }
    return "reservasi";
}

export function labelRole(role: Role | null): string {
    return role ? (DAFTAR_ROLE[role] ?? "-") : "-";
}

/** Peta kemampuan yang dibutuhkan setiap menu sidebar. */
const AKSES_MENU: Record<string, string> = {
    beranda: "beranda",
    input: "pesanan.tulis",
    data: "pesanan.lihat",
    unit: "master.lihat",
    ketersediaan: "master.lihat",
    driver: "master.lihat",
    customer: "master.lihat",
    partner: "master.lihat",
    include: "master.lihat",
    asisten: "asisten",
    import_xlsx: "import",
    import: "import",
    pengaturan: "pengaturan",
    laporan: "laporan",
    audit: "audit.lihat",
    manajemen_user: "user.kelola",
    ubah_password: "profil",
    arus_kas: "keuangan.bayar",
    piutang: "keuangan.bayar",
};

export function aksesMenu(kunci: string): string {
    return AKSES_MENU[kunci] ?? "beranda";
}

/** Apakah menu dengan kunci tertentu boleh ditampilkan untuk peran ini? */
export function menuTampil(role: Role, kunci: string): boolean {
    return roleBoleh(role, aksesMenu(kunci));
}

/** Apakah peran ini boleh melihat modal/margin/laba? */
export function bolehLihatModal(role: Role): boolean {
    return roleBoleh(role, "lihat_modal");
}

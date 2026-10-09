/*
 * Helper format — port 1:1 dari app/Support/helpers.php (yang sendiri salinan
 * dari includes/functions.php sistem lama). Teks tanggal/rupiah harus sama persis.
 */

const BULAN_SINGKAT = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const BULAN_PANJANG = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Format rupiah: 1234567 -> "Rp 1.234.567" (pemisah ribuan titik). */
export function rupiah(n: number | string | null | undefined, prefix = true): string {
    const angka = Math.round(Number(n ?? 0)) || 0;
    const s = angka.toLocaleString("id-ID");
    return prefix ? `Rp ${s}` : s;
}

/** Ambil digit saja dari sebuah string, jadikan integer (mis. "Rp 1.500.000" -> 1500000). */
export function angka(s: unknown): number {
    const digit = String(s ?? "").replace(/[^0-9]/g, "");
    return digit === "" ? 0 : parseInt(digit, 10);
}

/** Normalisasi nomor HP ke bentuk +62. */
export function normalisasiHp(hp: string | null | undefined): string {
    let d = String(hp ?? "").replace(/[^0-9]/g, "");
    if (d === "") {
        return "";
    }
    if (d.startsWith("0")) {
        d = "62" + d.slice(1);
    } else if (d.startsWith("8")) {
        d = "62" + d;
    }
    return "+" + d;
}

export function bulanSingkat(b: number): string {
    return BULAN_SINGKAT[b] ?? "";
}

export function bulanPanjang(b: number): string {
    return BULAN_PANJANG[b] ?? "";
}

/**
 * Parsing tanggal "YYYY-MM-DD" (atau "YYYY-MM-DD HH:MM:SS") menjadi komponen
 * UTC. Semua format di bawah membaca komponen UTC supaya tanggal TIDAK bergeser
 * karena zona waktu (sama seperti PHP yang menerima teks apa adanya).
 */
function parts(tgl: string | null | undefined): {
    y: number; m: number; d: number; jam: number; menit: number; detik: number;
} | null {
    if (!tgl) {
        return null;
    }
    const m = String(tgl).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) {
        return null;
    }
    return {
        y: Number(m[1]),
        m: Number(m[2]),
        d: Number(m[3]),
        jam: Number(m[4] ?? 0),
        menit: Number(m[5] ?? 0),
        detik: Number(m[6] ?? 0),
    };
}

/** "03 Okt 2026" — tanggal BER-NOL, sama seperti date('d') di PHP. jangan diganti ke tanpa-nol. */
export function tglId(tgl: string | null | undefined, tahun = true): string {
    const p = parts(tgl);
    if (!p) {
        return "-";
    }
    return `${pad(p.d, 2)} ${bulanSingkat(p.m)}${tahun ? " " + p.y : ""}`;
}

/** "03-10-2026" */
export function tglAngka(tgl: string | null | undefined): string {
    const p = parts(tgl);
    if (!p) {
        return "-";
    }
    return `${pad(p.d, 2)}-${pad(p.m, 2)}-${p.y}`;
}

/** "03-Okt-26" (dipakai halaman cetak invoice) */
export function tglSingkat(tgl: string | null | undefined): string {
    const p = parts(tgl);
    if (!p) {
        return "-";
    }
    return `${pad(p.d, 2)}-${bulanSingkat(p.m)}-${pad(p.y % 100, 2)}`;
}

/** Nomor hari dalam seminggu (0=Minggu .. 6=Sabtu) dari komponen UTC. */
function hariDari(p: { y: number; m: number; d: number }): number {
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** "Senin, 6 Oktober 2026" — untuk hari ini (zona Asia/Jakarta) bila tak diberi tanggal. */
export function hariPanjang(tgl?: string | null): string {
    let p = parts(tgl);
    if (!p) {
        p = parts(sekarangJakarta());
    }
    if (!p) {
        return "-";
    }
    return `${HARI_PANJANG[hariDari(p)]}, ${p.d} ${bulanPanjang(p.m)} ${p.y}`;
}

/**
 * Jumlah hari INKLUSIF: (selesai - mulai) + 1.
 * Contoh: 27-09-2026 s/d 30-09-2026 = 4 hari.
 */
export function hitungHari(mulai: string | null | undefined, selesai: string | null | undefined): number {
    const a = parts(mulai);
    const b = parts(selesai);
    if (!a || !b) {
        return 0;
    }
    const ta = Date.UTC(a.y, a.m - 1, a.d);
    const tb = Date.UTC(b.y, b.m - 1, b.d);
    if (tb < ta) {
        return 0;
    }
    return Math.floor((tb - ta) / 86400000) + 1;
}

/** Potong teks dengan elipsis. */
export function potong(s: unknown, n: number): string {
    const str = String(s ?? "");
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function pad(n: number, lebar: number): string {
    return String(n).padStart(lebar, "0");
}

/** Tanggal hari ini di zona Asia/Jakarta sebagai "YYYY-MM-DD". */
export function sekarangJakarta(): string {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return fmt.format(new Date());
}

/** Waktu sekarang di zona Asia/Jakarta sebagai "YYYY-MM-DD HH:MM:SS". */
export function sekarangJakartaWaktu(): string {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const b = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${b.year}-${b.month}-${b.day} ${b.hour}:${b.minute}:${b.second}`;
}

/* ============================== LABEL STATUS ============================== */

export const DAFTAR_STATUS = [
    "draft", "inquiry", "quoted", "waiting_dp", "booked", "in_trip",
    "completed", "invoiced", "paid", "reported", "cancelled", "closed",
] as const;

const PETA_STATUS: Record<string, string> = {
    draft: "Draft", inquiry: "Inquiry", quoted: "Penawaran", waiting_dp: "Menunggu DP",
    booked: "Booked", in_trip: "Sedang Trip", completed: "Selesai Trip",
    invoiced: "Invoice Terbit", paid: "Lunas", reported: "Masuk Laporan",
    cancelled: "Batal", closed: "Ditutup",
    terbit: "Invoice Terbit", sebagian: "Dibayar Sebagian", lunas: "Lunas", batal: "Batal",
};

export function statusLabel(s: string): string {
    return PETA_STATUS[s] ?? (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " "));
}

/* Peta kelas pill — 6 tahap siklus hidup (lihat DESIGN.md). Jangan diubah. */
const PETA_BADGE: Record<string, string> = {
    draft: "slate", inquiry: "slate", quoted: "blue", waiting_dp: "amber",
    booked: "blue", in_trip: "cyan", completed: "green", invoiced: "blue",
    paid: "green", reported: "slate", cancelled: "red", closed: "slate",
    terbit: "blue", sebagian: "amber", lunas: "green", batal: "red",
};

export function statusBadgeClass(s: string): string {
    return PETA_BADGE[s] ?? "slate";
}

export function labelWilayah(w: string): string {
    return w === "luar_kota" ? "Luar Kota" : "Dalam Kota";
}

export function labelTipePelanggan(t: string): string {
    const m: Record<string, string> = {
        retail: "Retail (Perorangan)", corporate: "Perusahaan / Instansi",
        RO: "Repeat Order", RTR: "RTR (Rent to Rent)",
    };
    return m[t] ?? t;
}

export function labelSumber(s: string): string {
    const m: Record<string, string> = {
        wa: "WhatsApp", telepon: "Telepon", instagram: "Instagram", tiktok: "TikTok",
        facebook: "Facebook", website: "Website", referral: "Referral", lainnya: "Lainnya",
    };
    return m[s] ?? s;
}

/* ============================== PAGINASI ============================== */

export interface Paginasi {
    total: number;
    per_page: number;
    halaman: number;
    jumlah_halaman: number;
    offset: number;
}

export function paginasi(total: number, perPage: number, halaman: number): Paginasi {
    const jumlahHalaman = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
    const hal = Math.max(1, Math.min(halaman, jumlahHalaman));
    return {
        total,
        per_page: perPage,
        halaman: hal,
        jumlah_halaman: jumlahHalaman,
        offset: (hal - 1) * perPage,
    };
}

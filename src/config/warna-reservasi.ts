/*
 * Warna kalender booking per reservasi — port dari config/warna_reservasi.php.
 * Dipakai papan ketersediaan unit: sel diberi warna sesuai SIAPA yang menangani.
 * Warna BUKAN satu-satunya pembeda — sel juga memuat inisial nama (lihat DESIGN.md).
 */

export interface WarnaReservasi {
    nama: string;
    warna: string;
    teks: string;
}

export const WARNA_RESERVASI: Record<string, WarnaReservasi> = {
    yus: { nama: "Yus", warna: "#9f1239", teks: "#ffffff" }, // crimson tua
    paul: { nama: "Paul", warna: "#198754", teks: "#ffffff" }, // hijau
    dela: { nama: "Dela", warna: "#0b5ed7", teks: "#ffffff" }, // biru (5.84:1 dg teks putih; #0d6efd = 4.499:1, gagal AA)
    admin: { nama: "Admin", warna: "#6f42c1", teks: "#ffffff" }, // ungu (data lama)
    _lain: { nama: "Lainnya", warna: "#6c757d", teks: "#ffffff" },
};

/** Warna untuk pembuat pesanan (port warnaPembuat). */
export function warnaPembuat(username: string | null | undefined): WarnaReservasi {
    const kunci = String(username ?? "").trim().toLowerCase();
    return WARNA_RESERVASI[kunci] ?? WARNA_RESERVASI._lain;
}

/** Daftar warna untuk legenda (tanpa kunci cadangan '_lain'). */
export function daftarWarnaReservasi(): Record<string, WarnaReservasi> {
    const out: Record<string, WarnaReservasi> = {};
    for (const [k, v] of Object.entries(WARNA_RESERVASI)) {
        if (k !== "_lain") {
            out[k] = v;
        }
    }
    return out;
}

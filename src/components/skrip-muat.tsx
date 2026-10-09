"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/*
 * Pemuat berkas JS lama (public/assets/js/*.js) supaya DIPAKAI ULANG apa adanya.
 *
 * Berkas-berkas itu skrip klasik (IIFE) yang membaca DOM saat dieksekusi, dan
 * app.js mendaftarkan inisialisasi lewat `DOMContentLoaded`. Karena itu:
 *  1) skrip dimuat BERURUTAN (bootstrap dulu, baru app.js, dst.);
 *  2) setelah semuanya selesai, dipancarkan ulang event `DOMContentLoaded`
 *     supaya pendaftaran di app.js ikut berjalan (event aslinya sudah lewat
 *     saat hidrasi selesai).
 *
 * Cara ini menjaga berkas lama TIDAK perlu diubah sama sekali.
 */
export function SkripMuat({ daftar }: { daftar: string[] }) {
    const pathname = usePathname();

    useEffect(() => {
        let dibatalkan = false;
        const dibuat: HTMLScriptElement[] = [];

        const muat = (i: number) => {
            if (dibatalkan) {
                return;
            }
            if (i >= daftar.length) {
                /* Semua skrip siap: jalankan inisialisasi yang menunggu DOMContentLoaded. */
                document.dispatchEvent(new Event("DOMContentLoaded"));
                return;
            }
            const s = document.createElement("script");
            s.src = daftar[i];
            s.async = false;
            s.onload = () => muat(i + 1);
            s.onerror = () => muat(i + 1);
            document.body.appendChild(s);
            dibuat.push(s);
        };
        muat(0);

        return () => {
            dibatalkan = true;
            for (const s of dibuat) {
                s.remove();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, daftar.join("|")]);

    return null;
}

/* Skrip inti aplikasi — dipakai di layout (semua halaman). */
export const SKRIP_INTI = [
    "/assets/vendor/bootstrap/bootstrap.bundle.min.js",
    "/assets/js/app.js?v=20261003b",
    "/assets/js/scroll-keep.js?v=20261005a",
];

/* Skrip khusus form pesanan. */
export const SKRIP_FORM_PESANAN = [
    "/assets/js/pesanan_form_ext.js",
    "/assets/js/parse_pesanan.js?v=20261003a",
];

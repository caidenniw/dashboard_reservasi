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
/* Skrip sekali-jalan per dokumen (layout & widget): kodenya terikat pada DOM
   yang bertahan antar soft-nav — eksekusi ulang menggandakan listener level
   dokumen. Cleanup efek pathname melepas tag-nya, jadi penanda di sini yang
   mencegah muat ulang. Skrip halaman TIDAK ikut: tiap kunjungan wajib
   eksekusi ulang untuk mengikat DOM baru. */
const sekaliJalan = new Set<string>();

export function SkripMuat({ daftar, sekali = false }: { daftar: string[]; sekali?: boolean }) {
    const pathname = usePathname();

    useEffect(() => {
        let dibatalkan = false;
        const dibuat: HTMLScriptElement[] = [];

        const muat = (i: number, jalan: number) => {
            if (dibatalkan) {
                return;
            }
            if (i >= daftar.length) {
                /* Pancarkan ulang DOMContentLoaded hanya bila ada skrip yang benar-benar
                   dieksekusi; rantai yang dilewati total (soft nav) tak mengulang init. */
                if (jalan > 0) {
                    document.dispatchEvent(new Event("DOMContentLoaded"));
                }
                return;
            }
            const src = daftar[i];
            if (sekali && sekaliJalan.has(src)) {
                muat(i + 1, jalan);
                return;
            }
            const s = document.createElement("script");
            s.src = src;
            s.async = false;
            s.onload = () => {
                if (sekali) {
                    sekaliJalan.add(src);
                }
                muat(i + 1, jalan + 1);
            };
            s.onerror = () => muat(i + 1, jalan + 1);
            document.body.appendChild(s);
            dibuat.push(s);
        };
        muat(0, 0);

        return () => {
            dibatalkan = true;
            for (const s of dibuat) {
                s.remove();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, daftar.join("|"), sekali]);

    return null;
}

/* Skrip inti aplikasi — dipakai di layout (semua halaman). */
export const SKRIP_INTI = [
    "/assets/vendor/bootstrap/bootstrap.bundle.min.js",
    "/assets/js/app.js?v=20261009c",
    "/assets/js/scroll-keep.js?v=20261010c",
];

/* Skrip khusus form pesanan. */
export const SKRIP_FORM_PESANAN = [
    "/assets/js/pesanan_form_ext.js",
    "/assets/js/parse_pesanan.js?v=20261003a",
];

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/*
 * Bilah progres tipis di atas layar untuk transisi navigasi lunak.
 * Muncul saat klik tautan lintas-rute (next/link) atau submit form GET;
 * hilang ketika URL benar-benar berubah, atau dipaksa setelah 8 detik bila
 * navigasi batal. Navigasi dokumen penuh memakai indikator bawaan peramban —
 * komponen ikut terbongkar, jadi tidak perlu penanganan khusus.
 *
 * Gaya ditulis sebagai kolok <style> (pola GAYA_LAPORAN di halaman laporan);
 * warna memakai token app.css — tanpa warna mentah baru.
 */
const GAYA_PROGRES = `
.navigasi-progres { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 1100; overflow: hidden; background: var(--primary-subtle); }
.navigasi-progres::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 40%; background: var(--primary); animation: rn-progres-geser 1s ease-in-out infinite; }
@keyframes rn-progres-geser { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
@media (prefers-reduced-motion: reduce) { .navigasi-progres::after { animation: none; width: 100%; } }
`;

/** Paksa sembunyi setelah lama tanpa perubahan URL (navigasi batal / lambat). */
const BATAS_DETIK = 8000;

export function NavigasiProgres() {
    const pathname = usePathname();
    const pencarian = useSearchParams();
    const [progres, setProgres] = useState(false);
    const jeda = useRef<number | null>(null);

    /* Efek jalan ulang tiap URL berubah: cleanup-nya mereset timer + bilah,
       lalu listener dipasang ulang untuk rute berikutnya. */
    useEffect(() => {
        const berhenti = () => {
            if (jeda.current !== null) {
                window.clearTimeout(jeda.current);
                jeda.current = null;
            }
            setProgres(false);
        };
        const mulai = () => {
            if (jeda.current !== null) {
                return;
            }
            setProgres(true);
            jeda.current = window.setTimeout(berhenti, BATAS_DETIK);
        };

        const klik = (ev: MouseEvent) => {
            if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) {
                return;
            }
            let el: Node | null = ev.target instanceof Node ? ev.target : null;
            while (el && el !== document && !(el instanceof HTMLAnchorElement)) {
                el = el.parentNode;
            }
            if (!(el instanceof HTMLAnchorElement)) {
                return;
            }
            const href = el.getAttribute("href") ?? "";
            if (el.target === "_blank" || href === "" || href.charAt(0) === "#") {
                return;
            }
            if (el.pathname !== location.pathname) {
                mulai();
            }
        };
        const kirim = (ev: Event) => {
            const f = ev.target;
            if (f instanceof HTMLFormElement && String(f.method).toLowerCase() === "get") {
                mulai();
            }
        };

        document.addEventListener("click", klik);
        document.addEventListener("submit", kirim, true);
        return () => {
            berhenti();
            document.removeEventListener("click", klik);
            document.removeEventListener("submit", kirim, true);
        };
    }, [pathname, pencarian]);

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: GAYA_PROGRES }} />
            {progres && (
                <div className="navigasi-progres" role="progressbar" aria-label="Memuat halaman" aria-busy="true" />
            )}
        </>
    );
}

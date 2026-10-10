"use client";

import Link from "next/link";
import { TampilJudul } from "@/components/judul-halaman";

/*
 * Topbar — port 1:1 dari <header class="topbar"> di layouts/app.blade.php.
 * Tombol Pesanan Baru hanya tampil bila peran boleh menulis pesanan
 * (sama seperti menu "input" yang disaring di sidebar).
 *
 * MARKUP: kelas design-system legacy (topbar/btn-hamburger/btn-tema/user-chip)
 * dipertahankan — ikon terang/gelap & aturan mobile diatur app.css.
 */

export function Topbar({
    nama,
    bolehTulisPesanan,
    tanggal,
}: {
    nama: string;
    bolehTulisPesanan: boolean;
    tanggal: string;
}) {
    const inisial = (nama || "A").charAt(0).toUpperCase();
    /* Panggil fungsi shell lewat window — HANYA di dalam handler (tidak saat render). */
    const panggil = (nama: string) => {
        const fn = (window as unknown as Record<string, (() => void) | undefined>)[nama];
        fn?.();
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button
                    type="button"
                    className="btn-hamburger lg:hidden"
                    onClick={() => panggil("rnBukaSidebarMobile")}
                    aria-controls="sidebarApp"
                    aria-label="Buka Menu"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <button
                    type="button"
                    className="btn-hamburger hidden lg:flex"
                    id="btnSidebarLipat"
                    onClick={() => panggil("rnToggleSidebarDesktop")}
                    aria-controls="sidebarApp"
                    aria-expanded="true"
                    aria-label="Lipat atau buka menu"
                    title="Lipat menu"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M9 3v18" />
                        <path d="m14 9 3 3-3 3" />
                    </svg>
                </button>
                <TampilJudul />
            </div>

            <div className="topbar-right">
                <span className="topbar-date">{tanggal}</span>
                {bolehTulisPesanan && (
                    <Link href="/pesanan/baru" className="btn btn-sm btn-primary btn-quick-order" aria-label="Pesanan Baru">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-1" aria-hidden="true" focusable="false"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        <span>Pesanan Baru</span>
                    </Link>
                )}
                <button
                    type="button"
                    className="btn-tema"
                    id="btnTema"
                    onClick={() => panggil("rnGantiTema")}
                    aria-label="Ganti tema terang/gelap"
                    title="Ganti tema"
                >
                    <svg className="ikon-gelap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                    <svg className="ikon-terang" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                </button>
                <div className="user-chip">
                    <span className="avatar">{inisial}</span>
                    <span className="hidden sm:inline">{nama}</span>
                </div>
            </div>
        </header>
    );
}

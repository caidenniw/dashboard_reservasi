"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU, type ItemMenu } from "@/config/menu";
import { metaRute } from "@/config/rute";
import { menuTampil, labelRole, type Role } from "@/lib/akses";
import { APP_NAME, APP_SUB } from "@/lib/brand";

/*
 * Sidebar — pohon menu bertingkat: grup induk (tombol akordeon) → item leaf.
 * Grup tampil bila minimal satu anak lolos filter peran; grup yang membungkus
 * menu aktif terbuka otomatis (saat mount dan saat rute berganti).
 * `menuAktif` dihitung di server dari path, jadi penyorotan sama seperti Blade.
 *
 * MARKUP: kelas design-system legacy (sidebar-brand/nav-item/dst) dipertahankan
 * 1:1 — aturan `html.sidebar-ciut` di app.css menyembunyikan label/slogan/info
 * sendiri saat sidebar dilipat, jadi React tidak perlu mengganti markup.
 */

/** Kunci localStorage untuk grup akordeon yang sedang terbuka. */
const KUNCI_BUKA = "rn_sidebar_buka";

/** Kunci grup induk yang tersimpan di localStorage; selain grup valid diabaikan. */
function bacaBukaTersimpan(): string[] {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const mentah = JSON.parse(localStorage.getItem(KUNCI_BUKA) ?? "[]");
        const grupValid: Record<string, true> = {};
        for (const m of MENU) {
            if (m.anak) {
                grupValid[m.key] = true;
            }
        }
        return Array.isArray(mentah) ? mentah.filter((k) => typeof k === "string" && grupValid[k] === true) : [];
    } catch {
        return [];
    }
}

/** Kunci grup induk (tanpa leaf top-level) yang membungkus kunci menu aktif. */
function indukDari(kunci: string): string | null {
    for (const m of MENU) {
        if (m.anak?.some((a) => a.key === kunci)) {
            return m.key;
        }
    }
    return null;
}

export function Sidebar({
    nama,
    role,
}: {
    nama: string;
    role: Role;
}) {
    /* Menu aktif dihitung dari pathname klien: layout TIDAK re-render saat soft
       nav (segmen layout dipakai ulang Router Cache), jadi prop server basi. */
    const pathname = usePathname();
    const menuAktif = metaRute(pathname).menu;
    const inisial = (nama || "A").charAt(0).toUpperCase();
    const [buka, setBuka] = useState<Record<string, boolean>>(() => {
        const induk = indukDari(menuAktif);
        return induk ? { [induk]: true } : {};
    });
    /* Sidebar ciut menyembunyikan label + submenu lewat CSS; state ini dipakai
       supaya aria-expanded tidak berbohong dan klik grup melebarkan sidebar dulu. */
    const [ciut, setCiut] = useState(false);
    const [siapSimpan, setSiapSimpan] = useState(false);

    /* Pulihkan grup yang terakhir dibuka user (merge, tidak menimpa induk aktif). */
    useEffect(() => {
        const simpan = bacaBukaTersimpan();
        if (simpan.length > 0) {
            setBuka((b) => {
                const gabung = { ...b };
                for (const k of simpan) {
                    gabung[k] = true;
                }
                return gabung;
            });
        }
        setSiapSimpan(true);
    }, []);

    /* Simpan setiap perubahan; baru aktif setelah pemulihan selesai agar state awal
       tidak menimpa pilihan user yang tersimpan. */
    useEffect(() => {
        if (!siapSimpan) {
            return;
        }
        try {
            localStorage.setItem(KUNCI_BUKA, JSON.stringify(Object.keys(buka).filter((k) => buka[k])));
        } catch {
            /* localStorage bisa diblokir; abaikan. */
        }
    }, [buka, siapSimpan]);

    /* Rute berganti di klien (App Router) — buka grup yang membungkus menu baru. */
    useEffect(() => {
        const induk = indukDari(menuAktif);
        if (induk) {
            setBuka((b) => (b[induk] ? b : { ...b, [induk]: true }));
        }
    }, [menuAktif]);

    /* Ikuti kelas di <html> (tombol lipat & skrip anti-FOUC). */
    useEffect(() => {
        const akar = document.documentElement;
        const sinkron = () => setCiut(akar.classList.contains("sidebar-ciut"));
        sinkron();
        const pengamat = new MutationObserver(sinkron);
        pengamat.observe(akar, { attributes: true, attributeFilter: ["class"] });
        return () => pengamat.disconnect();
    }, []);

    const daun = (nav: ItemMenu, sub: boolean) => {
        if (!menuTampil(role, nav.key)) {
            return null;
        }
        const aktif = menuAktif === nav.key;
        return (
            <Link
                key={nav.key}
                href={nav.href}
                onClick={() => {
                    /* Soft nav: reload tak mereset drawer mobile — tutup dulu.
                       Penutup dari shell-aksi menempel di window, tak diketahui TS. */
                    const shell = window as unknown as { rnTutupSidebarMobile?: () => void };
                    shell.rnTutupSidebarMobile?.();
                }}
                className={`nav-item${sub ? " sub" : ""}${aktif ? " active" : ""}`}
                aria-label={nav.label}
                title={nav.label}
                aria-current={aktif ? "page" : undefined}
            >
                {!sub && <span className="nav-icon" dangerouslySetInnerHTML={{ __html: nav.icon }} />}
                <span className="nav-label">{nav.label}</span>
                {aktif && <span className="nav-dot" />}
            </Link>
        );
    };

    return (
        <aside className="sidebar" id="sidebarApp">
            <div className="sidebar-brand">
                <Link
                    href="/"
                    onClick={() => {
                        /* Tutup drawer mobile sebelum soft nav; API shell tak diketahui TS. */
                        const shell = window as unknown as { rnTutupSidebarMobile?: () => void };
                        shell.rnTutupSidebarMobile?.();
                    }}
                    className="brand-link"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/img/logo.png" alt={APP_NAME} className="brand-logo" />
                </Link>
                <div className="brand-sub">{APP_SUB}</div>
                <button
                    type="button"
                    className="btn-sidebar-close lg:hidden"
                    onClick={() => (window as unknown as { rnTutupSidebarMobile?: () => void }).rnTutupSidebarMobile?.()}
                    aria-label="Tutup Menu"
                >
                    &times;
                </button>
            </div>

            <div className="sidebar-scrollable">
                <nav className="sidebar-nav" aria-label="Menu utama">
                    {MENU.map((m) => {
                        if (!m.anak) {
                            return daun(m, false);
                        }
                        const anakTampil = m.anak.filter((a) => menuTampil(role, a.key));
                        if (anakTampil.length === 0) {
                            return null;
                        }
                        const adaAktif = anakTampil.some((a) => a.key === menuAktif);
                        const terbuka = buka[m.key] ?? false;
                        return (
                            <div key={m.key}>
                                <button
                                    type="button"
                                    className={`nav-group${adaAktif ? " has-active" : ""}`}
                                    onClick={() => {
                                        if (ciut) {
                                            (window as unknown as { rnToggleSidebarDesktop?: () => void }).rnToggleSidebarDesktop?.();
                                            setBuka((b) => ({ ...b, [m.key]: true }));
                                            return;
                                        }
                                        setBuka((b) => ({ ...b, [m.key]: !b[m.key] }));
                                    }}
                                    aria-expanded={terbuka && !ciut}
                                    aria-controls={`sub-${m.key}`}
                                    title={m.label}
                                >
                                    <span className="nav-icon" dangerouslySetInnerHTML={{ __html: m.icon }} />
                                    <span className="nav-label">{m.label}</span>
                                    <svg
                                        className="nav-chevron"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </button>
                                {terbuka && !ciut && (
                                    <div className="nav-sub" id={`sub-${m.key}`}>
                                        {anakTampil.map((a) => daun(a, true))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-foot">
                    <div className="sidebar-slogan">&quot;Satu Sistem Seribu Perjalanan&quot;</div>
                    <div className="user-profile-box">
                        <div className="user-avatar-circle">{inisial}</div>
                        <div className="user-info-text">
                            <div className="user-display-name">{nama}</div>
                            <div className="user-role-badge">{labelRole(role)}</div>
                        </div>
                    </div>
                    <form method="post" action="/logout" className="mt-2">
                        <button type="submit" className="btn-logout-sidebar">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            <span>Keluar Sistem</span>
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}

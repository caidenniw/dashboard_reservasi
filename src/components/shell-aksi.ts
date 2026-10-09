"use client";

/*
 * Aksi shell (sidebar & tema) — port fungsi global dari layouts/app.blade.php.
 * Dipasang ke `window` juga, supaya skrip lama yang dipakai ulang (app.js dll)
 * tetap bisa memanggilnya lewat nama yang sama.
 */

function el(id: string): HTMLElement | null {
    return document.getElementById(id);
}

/** Elemen yang memegang fokus sebelum drawer dibuka, untuk dikembalikan saat tutup. */
let pemicuTerakhir: HTMLElement | null = null;

export function rnBukaSidebarMobile(): void {
    pemicuTerakhir = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el("sidebarApp")?.classList.add("mobile-open");
    el("sidebarBackdrop")?.classList.add("mobile-open");
    document.body.style.overflow = "hidden";
    (el("sidebarApp")?.querySelector(".btn-sidebar-close") as HTMLElement | null)?.focus();
}

export function rnTutupSidebarMobile(): void {
    const sidebar = el("sidebarApp");
    if (!sidebar?.classList.contains("mobile-open")) {
        return;
    }
    sidebar.classList.remove("mobile-open");
    el("sidebarBackdrop")?.classList.remove("mobile-open");
    document.body.style.overflow = "";
    if (pemicuTerakhir && document.contains(pemicuTerakhir)) {
        pemicuTerakhir.focus();
    }
    pemicuTerakhir = null;
}

export function rnToggleSidebarDesktop(): void {
    const ciut = document.documentElement.classList.toggle("sidebar-ciut");
    const btn = el("btnSidebarLipat");
    if (btn) {
        btn.setAttribute("aria-expanded", ciut ? "false" : "true");
        btn.setAttribute("title", ciut ? "Buka menu" : "Lipat menu");
    }
    try {
        if (ciut) {
            localStorage.setItem("rn_sidebar", "lipat");
        } else {
            localStorage.removeItem("rn_sidebar");
        }
    } catch {
        /* localStorage bisa diblokir; abaikan. */
    }
}

export function rnGantiTema(): void {
    const kini = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";
    const baru = kini === "dark" ? "light" : "dark";
    const t = window as unknown as { RNTema?: { pasang?: (m: string) => void } };
    if (t.RNTema?.pasang) {
        t.RNTema.pasang(baru);
    } else {
        document.documentElement.setAttribute("data-bs-theme", baru);
        try {
            localStorage.setItem("rn_theme", baru);
        } catch {
            /* abaikan */
        }
    }
}

/** Pasang fungsi ke window + listener Escape + sinkronkan label tombol lipat. */
export function pasangAksiShell(): void {
    const w = window as unknown as Record<string, unknown>;
    w.rnBukaSidebarMobile = rnBukaSidebarMobile;
    w.rnTutupSidebarMobile = rnTutupSidebarMobile;
    w.rnToggleSidebarDesktop = rnToggleSidebarDesktop;
    w.rnGantiTema = rnGantiTema;

    document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
            rnTutupSidebarMobile();
        }
    });

    /* Sinkronkan aria tombol lipat dengan keadaan yang dipasang skrip <head>. */
    if (document.documentElement.classList.contains("sidebar-ciut")) {
        const btn = el("btnSidebarLipat");
        if (btn) {
            btn.setAttribute("aria-expanded", "false");
            btn.setAttribute("title", "Buka menu");
        }
    }
}

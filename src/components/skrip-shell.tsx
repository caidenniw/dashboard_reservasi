"use client";

import { useEffect } from "react";
import { pasangAksiShell } from "@/components/shell-aksi";

/*
 * Memasang fungsi shell ke window (rnBukaSidebarMobile, rnBukaSidebarMobile,
 * rnToggleSidebarDesktop, rnGantiTema) + listener Escape + sinkronisasi label.
 * Sekali pasang per pemuatan halaman penuh.
 */
export function SkripShell() {
    useEffect(() => {
        pasangAksiShell();
    }, []);
    return null;
}

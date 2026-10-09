"use client";

import { useState } from "react";
import type { FlashData } from "@/lib/flash";

/*
 * Alert flash — port dari blok foreach di layouts/app.blade.php.
 * Dua kanal terpisah: pesan tunggal (string) di sini, dan daftar validasi
 * (array) lewat komponen AlertValidasi. JANGAN dicampur.
 */
export function Alerts({ flash }: { flash: FlashData }) {
    const [visible, setVisible] = useState<Record<string, boolean>>({});

    const urutan: Array<[keyof FlashData, string]> = [
        ["success", "alert-success"],
        ["error", "alert-danger"],
        ["warning", "alert-warning"],
        ["info", "alert-info"],
    ];

    return (
        <>
            {urutan.map(([kunci, cls]) => {
                const pesan = flash[kunci];
                if (typeof pesan !== "string" || pesan === "" || visible[kunci] === false) {
                    return null;
                }
                return (
                    <div key={kunci} className={`alert ${cls} flex items-center justify-between mb-4 shadow-sm`} role="alert">
                        <span className="text-sm font-medium">{pesan}</span>
                        <button 
                            type="button" 
                            className="ml-4 text-current opacity-50 hover:opacity-100 transition-opacity" 
                            onClick={() => setVisible(prev => ({ ...prev, [kunci]: false }))} 
                            aria-label="Tutup peringatan" 
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                );
            })}
        </>
    );
}

/** Daftar kesalahan validasi — port dari pesanan/form.blade.php + user/index.blade.php. */
export function AlertValidasi({ pesan }: { pesan: string[] | undefined }) {
    if (!pesan || pesan.length === 0) {
        return null;
    }
    return (
        <div className="alert alert-danger flex flex-col mb-4 shadow-sm" role="alert">
            <strong className="text-sm font-bold mb-1">Periksa isian berikut</strong>
            <ul className="list-disc list-inside text-sm space-y-1">
                {pesan.map((er, i) => (
                    <li key={i}>{er}</li>
                ))}
            </ul>
        </div>
    );
}

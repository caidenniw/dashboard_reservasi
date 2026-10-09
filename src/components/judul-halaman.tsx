"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/config/menu";

/*
 * Remah navigasi di topbar. Rantai diambil dari config/menu (`jejak`), sedangkan
 * judul halaman datang dari `judulAwal` (meta.rute) dan bisa ditimpa halaman
 * lewat <JudulHalaman nilai="..." /> (event rn:judul).
 *
 * Remah terakhir memakai kelas `page-title`: public/assets/js/app.js membacanya
 * untuk konteks modal konfirmasi (nomor order / nama halaman).
 */

/** Dirender halaman untuk menetapkan judul topbar. */
export function JudulHalaman({ nilai }: { nilai: string }) {
    useEffect(() => {
        window.dispatchEvent(new CustomEvent("rn:judul", { detail: nilai }));
    }, [nilai]);
    return null;
}

/** Ditampilkan topbar; remah terakhir adalah judul halaman aktif. */
export function TampilJudul({ jejak, judulAwal }: { jejak: ItemMenu[]; judulAwal: string }) {
    const path = usePathname();
    const [judul, setJudul] = useState(judulAwal);

    /* Rute berganti di klien: judul kembali ke bawaan rute baru. */
    useEffect(() => {
        setJudul(judulAwal);
    }, [judulAwal]);

    useEffect(() => {
        function dengar(ev: Event) {
            const detail = (ev as CustomEvent<string>).detail;
            if (typeof detail === "string" && detail !== "") {
                setJudul(detail);
            }
        }
        window.addEventListener("rn:judul", dengar);
        return () => window.removeEventListener("rn:judul", dengar);
    }, []);

    /* Item menu yang menunjuk halaman ini sendiri dipakai sebagai judul remah
       terakhir, jadi rantainya tidak diulang. */
    const remah: Array<{ label: string; href: string }> = jejak
        .filter((i) => i.href === "" || i.href !== path)
        .map((i) => ({ label: i.label, href: i.href }));
    remah.push({ label: judul, href: "" });

    return (
        <nav className="remah" aria-label="Jejak navigasi">
            {remah.map((r, i) => (
                <span className="remah-item" key={`${r.label}-${i}`}>
                    {i > 0 && (
                        <svg
                            className="remah-pemisah"
                            aria-hidden="true"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    )}
                    {i === remah.length - 1 ? (
                        <span className="page-title remah-kini">{r.label}</span>
                    ) : r.href !== "" ? (
                        <a className="remah-taut" href={r.href}>{r.label}</a>
                    ) : (
                        <span className="remah-grup">{r.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}

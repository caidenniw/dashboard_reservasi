"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { jejakMenu } from "@/config/menu";
import { metaRute } from "@/config/rute";
import { APP_SUB } from "@/lib/brand";

/*
 * Remah navigasi di topbar. Rantai diambil dari config/menu (`jejak`), sedangkan
 * judul halaman datang dari `judulAwal` (meta.rute). Halaman bisa menimpa lewat
 * event `rn:judul` (pendengar di bawah) — komponen JudulHalaman pelopornya
 * sudah dihapus karena tak lagi dipakai halaman mana pun.
 *
 * Remah terakhir memakai kelas `page-title`: public/assets/js/app.js membacanya
 * untuk konteks modal konfirmasi (nomor order / nama halaman).
 */




/* Ditampilkan topbar; remah terakhir adalah judul halaman aktif.
   Jejak & judul dihitung dari pathname klien — layout tak re-render saat soft
   nav (Router Cache memakai ulang segmen layout), prop server jadi basi. */
export function TampilJudul() {
    const path = usePathname();
    const judulAwal = metaRute(path).judul;
    const jejak = jejakMenu(metaRute(path).menu);
    const [judul, setJudul] = useState(judulAwal);

    /* Rute berganti di klien: judul kembali ke bawaan rute baru. */
    useEffect(() => {
        setJudul(judulAwal);
    }, [judulAwal]);

    /* Metadata Next (generateMetadata) telat satu langkah saat soft nav karena
       cache Router — sinkronkan tab langsung; format = template root layout. */
    useEffect(() => {
        document.title = `${judulAwal} · ${APP_SUB}`;
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
                        <Link className="remah-taut" href={r.href}>{r.label}</Link>
                    ) : (
                        <span className="remah-grup">{r.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}

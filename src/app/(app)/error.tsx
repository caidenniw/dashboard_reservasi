"use client";

import { useEffect } from "react";

/*
 * Batas galat untuk seluruh halaman di dalam shell dashboard.
 * `reset()` mencoba merender ulang segmen yang gagal tanpa memuat ulang peramban.
 */
export default function Galat({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <>
            <div className="page-head">
                <span className="page-eyebrow">Galat</span>
                <h1 className="page-hero">Terjadi kesalahan</h1>
                <p className="page-sub">Halaman ini gagal dimuat.</p>
            </div>

            <div className="card-box">
                <p className="mb-3">Coba lagi; bila tetap gagal, muat ulang peramban.</p>
                <div className="baris-aksi">
                    <button type="button" className="btn btn-sm btn-primary" onClick={reset}>
                        Coba lagi
                    </button>
                    <a className="btn btn-sm btn-outline-secondary" href="/">Ke Beranda</a>
                </div>
            </div>
        </>
    );
}

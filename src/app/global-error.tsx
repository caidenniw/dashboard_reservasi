"use client";

import { useEffect } from "react";

/*
 * Error boundary tingkat root — dipakai saat root layout/gagal render
 * sehingga (app)/error.tsx tidak sempat menangani. Jangan tampilkan stack
 * ke pengguna; cukup pesan + jalan pulang.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="id">
            <body>
                <div className="halaman-polos">
                    <div className="card-box" style={{ maxWidth: 420, textAlign: "center", padding: 32 }}>
                        <h1 className="page-hero" style={{ fontSize: 22 }}>Terjadi kesalahan</h1>
                        <p className="page-sub">Muat ulang halaman. Bila berulang, hubungi pengelola.</p>
                        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                            Muat ulang
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}

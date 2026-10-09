import type { Metadata } from "next";

/*
 * 404 di dalam shell dashboard — dipakai semua pemanggil notFound()
 * (modul master, detail pesanan, ubah pesanan, bukti, teks WA, trip driver).
 */
export const metadata: Metadata = { title: "Halaman tidak ditemukan · 1000 Nusantara" };

export default function TidakDitemukan() {
    return (
        <>
            <div className="page-head">
                <span className="page-eyebrow">404</span>
                <h1 className="page-hero">Halaman tidak ditemukan</h1>
                <p className="page-sub">Data yang kamu cari tidak ada atau sudah dihapus.</p>
            </div>

            <div className="card-box">
                <p className="mb-3">Periksa kembali tautan atau nomor order, lalu kembali ke daftar pesanan.</p>
                <a className="btn btn-sm btn-primary" href="/">Ke Beranda</a>
            </div>
        </>
    );
}

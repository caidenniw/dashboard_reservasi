import type { Metadata } from "next";

/*
 * 404 untuk alamat yang tidak cocok rute mana pun (di luar shell dashboard),
 * menggantikan halaman bawaan Next.js yang berbahasa Inggris.
 */
export const metadata: Metadata = { title: "Halaman tidak ditemukan · 1000 Nusantara" };

export default function TidakDitemukan() {
    return (
        <main className="halaman-polos">
            <div className="card-box kotak-sempit-sm">
                <h1 className="judul-galat">Halaman tidak ditemukan</h1>
                <p className="page-sub">Alamat yang kamu buka tidak ada atau sudah dipindahkan.</p>
                <a className="btn btn-sm btn-primary mt-3" href="/">Ke Beranda</a>
            </div>
        </main>
    );
}

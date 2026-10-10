import { harusMasuk } from "@/lib/sesi";
import { Suspense } from "react";
import { pathPermintaan } from "@/lib/path";
import { metaRute } from "@/config/rute";
import type { Metadata } from "next";
import { ambilFlash } from "@/lib/flash-server";
import { roleBoleh } from "@/lib/akses";
import { hariPanjang } from "@/lib/format";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Alerts } from "@/components/alerts";
import { ModalKonfirmasi } from "@/components/modal-konfirmasi";
import { BackdropSeluler } from "@/components/backdrop-seluler";
import { SkripShell } from "@/components/skrip-shell";
import { SkripMuat, SKRIP_INTI } from "@/components/skrip-muat";
import { NavigasiProgres } from "@/components/navigasi-progres";
import { WidgetAsisten } from "@/components/widget-asisten";

/*
 * Shell aplikasi — port 1:1 dari resources/views/layouts/app.blade.php.
 *
 * Skrip berkas lama (bootstrap/app.js/scroll-keep) dijalankan lewat <SkripMuat />
 * secara berurutan, lalu event DOMContentLoaded dipancarkan ulang supaya
 * pendaftaran inisialisasi di app.js ikut berjalan — tanpa mengubah berkas JS-nya.
 */
/** Judul tab & riwayat mengikuti halaman aktif, bukan satu judul untuk semua. */
export async function generateMetadata(): Promise<Metadata> {
    const path = await pathPermintaan();
    return { title: metaRute(path).judul };
}

export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
    const user = await harusMasuk();
    const flash = await ambilFlash();

    return (
        <>
            <BackdropSeluler />
            <SkripShell />

            <a className="lewati" href="#konten-utama">Lewati ke konten utama</a>

            {/* useSearchParams butuh Suspense; fallback null = bilah tak terlihat saat init */}
            <Suspense fallback={null}>
                <NavigasiProgres />
            </Suspense>

            <div className="app">
                <Sidebar nama={user.nama} role={user.role} />

                <main className="content" id="konten-utama" tabIndex={-1}>
                    <Topbar
                        nama={user.nama}
                        bolehTulisPesanan={roleBoleh(user.role, "pesanan.tulis")}
                        tanggal={hariPanjang()}
                    />

                    <div className="page">
                        <Alerts flash={flash} />
                        {children}
                    </div>
                </main>
            </div>

            <ModalKonfirmasi />
            <WidgetAsisten role={user.role} />

            <SkripMuat daftar={SKRIP_INTI} sekali />
        </>
    );
}

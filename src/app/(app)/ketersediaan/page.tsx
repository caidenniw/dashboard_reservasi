import { harusMasuk } from "@/lib/sesi";
import { ambilKalender } from "@/lib/beranda-server";
import { KalenderUnit } from "../_kalender-unit";

/*
 * Ketersediaan Unit & Driver — papan kalender yang sebelumnya menempel di
 * Beranda, kini berdiri sendiri sebagai tujuan menu (submenu Pesanan).
 * HANYA MEMBACA data; query params: hari, unit, semua (sama seperti dulu).
 */

export default async function HalamanKetersediaan({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await harusMasuk();
    const sp = await searchParams;
    const teks = (k: string, d = "") => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v ?? d).trim();
    };

    const k = await ambilKalender({
        periode: "",
        dari: "",
        sampai: "",
        hari: teks("hari"),
        unit: teks("unit"),
        semua: teks("semua"),
    });

    return (
        <>

            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pesanan &middot; Operasional</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Ketersediaan Unit &amp; Driver</h1>
                <p className="text-ink-soft mt-2">
                    Papan jadwal mendatang — lihat unit dan driver yang sudah terpesan
                    sebelum menempatkan order baru.
                </p>
            </div>

            <KalenderUnit k={k} params={sp} />
        </>
    );
}

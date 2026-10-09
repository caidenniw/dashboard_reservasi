import { harusMasuk } from "@/lib/sesi";
import { bulanPanjang, DAFTAR_STATUS, statusLabel } from "@/lib/format";
import { daftarPesanan, filterDari } from "@/lib/pesanan-server";
import { TabelPesanan } from "./tabel";

/*
 * Data Pesanan & Invoice — daftar pesanan.
 * Port dari pesanan/index.blade.php + pesanan/_tabel.blade.php.
 *
 * htmx digantikan form GET biasa (muat ulang halaman penuh). Ini justru paling
 * mendekati perilaku lama: scroll-keep.js memang menangani submit form GET dan
 * menjaga posisi scroll. Kontrak DOM (#daftar, id cari/status/tipe/urut/bulan/
 * dari/sampai) dipertahankan.
 */
export default async function HalamanPesanan({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await harusMasuk();
    const sp = await searchParams;
    const f = filterDari(sp);
    const { rows, pg, total, bulanList } = await daftarPesanan(f);

    /* Bangun query string untuk paginasi (pertahankan filter, ganti hal). */
    const qs = (hal: number) => {
        const p = new URLSearchParams();
        if (f.cari) p.set("cari", f.cari);
        if (f.status) p.set("status", f.status);
        if (f.tipe) p.set("tipe", f.tipe);
        if (f.urut) p.set("urut", f.urut);
        if (f.bulan) p.set("bulan", f.bulan);
        if (f.dari) p.set("dari", f.dari);
        if (f.sampai) p.set("sampai", f.sampai);
        if (hal > 1) p.set("hal", String(hal));
        return p.toString();
    };

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pesanan · Daftar</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Daftar Pesanan</h1>
                <p className="text-ink-soft mt-2">Kelola dan pantau semua pesanan pelanggan.</p>
            </div>

            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                <form method="get" action="/pesanan" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-ink-soft" htmlFor="cari">Cari</label>
                        <input type="text" name="cari" id="cari" className="w-full p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary" defaultValue={f.cari} placeholder="Nama, Nopol..." />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="status">Status</label>
                        <select name="status" id="status" defaultValue={f.status ?? ""} className="w-full p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Semua Status</option>
                            {DAFTAR_STATUS.map((st) => (
                                <option key={st} value={st}>{statusLabel(st)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="tipe">Tipe</label>
                        <select name="tipe" id="tipe" defaultValue={f.tipe ?? ""} className="w-full p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Semua Tipe</option>
                            <option value="retail">Retail (Perorangan)</option>
                            <option value="corporate">Perusahaan / Instansi</option>
                            <option value="RO">Repeat Order</option>
                            <option value="RTR">RTR (Rent to Rent)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="urut">Urut</label>
                        <select name="urut" id="urut" defaultValue={f.urut || "desc"} className="w-full p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary">
                            <option value="desc">Terbaru</option>
                            <option value="asc">Terlama</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="bulan">Bulan</label>
                        <select name="bulan" id="bulan" defaultValue={f.bulan ?? ""} className="w-full p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Semua Bulan</option>
                            {bulanList.map((b) => (
                                <option key={b} value={b}>{bulanPanjang(Number(b.slice(5, 7)))} {b.slice(0, 4)}</option>
                            ))}
                        </select>
                    </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        {(f.cari || f.status || f.tipe || (f.urut && f.urut !== "desc") || f.bulan || f.dari || f.sampai) && (
                            <a href="/pesanan" className="px-4 py-2 border border-line-strong text-ink-soft hover:bg-surface-2 rounded-lg text-sm font-medium transition-colors">Reset</a>
                        )}
                        <a href="/pesanan/baru" className="px-4 py-2 border border-primary text-primary hover:bg-primary-subtle rounded-lg text-sm font-medium transition-colors">+ Pesanan Baru</a>
                        <button type="submit" className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors">Saring</button>
                    </div>
                </form>
            </div>

            <div id="daftar">
                <TabelPesanan rows={rows} pg={pg} total={total} qs={qs} />
            </div>
        </>
    );
}

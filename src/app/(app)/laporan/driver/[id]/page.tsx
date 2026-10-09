import { notFound } from "next/navigation";
import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { rupiah, tglId } from "@/lib/format";
import { ambilDriverDetail } from "@/lib/laporan-server";
import { BadgeStatus } from "@/components/badge-status";

/*
 * Detail trip per driver — port 1:1 dari resources/views/laporan/driver.blade.php
 * + LaporanController::driverDetail. HANYA MEMBACA data.
 * Driver tidak ada -> notFound() (404), sama seperti halaman detail pesanan.
 */

/** Gaya khas halaman ini — salinan @push('gaya') Blade (.periode-bar/chip/label global di app.css). */
const GAYA_DRIVER = `
.periode-form { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; margin-bottom:var(--space-2); }
.periode-form label { font-size:.86rem; margin:0; }
.periode-form input[type=date] { max-width:190px; }

.ringkas-box { border:1px solid var(--line); border-radius:var(--radius-card); padding:var(--space-2) var(--space-3); }
.ringkas-label { font-size:.78rem; color:var(--ink-soft); }
.ringkas-nilai { font-weight:700; font-size:1.02rem; font-variant-numeric:tabular-nums; }
.foto-driver { height:84px; width:84px; object-fit:cover; border-radius:var(--radius-card); border:1px solid var(--line); }
`;

export default async function HalamanTripDriver({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "laporan")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Laporan Penjualan.</p>
            </div>
        );
    }

    const { id } = await params;
    const sp = await searchParams;
    const teks = (k: string) => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v ?? "").trim();
    };

    const d = await ambilDriverDetail(Number(id) || 0, { mode: teks("mode"), acuan: teks("acuan") }, user);
    if (!d) {
        notFound();
    }
    const driver = d.driver;

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Laporan · Trip Driver</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Trip Driver</h1>
                <p className="text-ink-soft mt-2">Rincian perjalanan driver pada periode laporan.</p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: GAYA_DRIVER }} />

            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-4">
                    <h2 className="text-xl font-bold text-ink">Trip {driver.nama}</h2>
                    <a
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors"
                        href={`/laporan/penjualan?mode=${d.mode}&acuan=${d.acuan}`}
                    >
                        ← Kembali ke laporan
                    </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {driver.foto ? (
                        <div className="col-span-1">
                            {/* Foto unggahan pengguna: jalur dinamis di /uploads, bukan aset
                                statis yang bisa dioptimasi next/image. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="h-20 w-20 object-cover rounded-xl border border-line"
                                src={"/" + String(driver.foto).replace(/^\/+/, "")}
                                alt={`Foto ${driver.nama}`}
                            />
                        </div>
                    ) : null}
                    <div className="p-3 bg-surface-2 rounded-lg border border-line">
                        <div className="text-[10px] uppercase font-bold text-ink-soft">Jenjang</div>
                        <div className="font-bold text-sm text-ink">{driver.jenjang || "-"}</div>
                    </div>
                    <div className="p-3 bg-surface-2 rounded-lg border border-line">
                        <div className="text-[10px] uppercase font-bold text-ink-soft">Wilayah</div>
                        <div className="font-bold text-sm text-ink">{driver.wilayah || "-"}</div>
                    </div>
                    <div className="p-3 bg-surface-2 rounded-lg border border-line">
                        <div className="text-[10px] uppercase font-bold text-ink-soft">Total Trip</div>
                        <div className="font-bold text-sm text-ink">{d.totalTrip}</div>
                    </div>
                    <div className="p-3 bg-surface-2 rounded-lg border border-line">
                        <div className="text-[10px] uppercase font-bold text-ink-soft">Total Hari</div>
                        <div className="font-bold text-sm text-ink">{d.totalHari}</div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                    {Object.entries(d.modePilihan).map(([k, lbl]) => (
                        <a
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${d.mode === k ? "bg-primary-fill border-primary-fill text-on-primary" : "bg-surface border-line-strong text-ink-soft hover:bg-surface-2"}`}
                            href={`/laporan/driver/${driver.id}?mode=${k}&acuan=${d.acuan}`}
                            key={k}
                        >
                            {lbl}
                        </a>
                    ))}
                    <span className="text-xs font-medium text-ink-soft ml-2">{d.labelPeriode}</span>
                </div>

                <form className="flex flex-wrap items-center gap-3 mb-6" method="get" action={`/laporan/driver/${driver.id}`}>
                    <input type="hidden" name="mode" value={d.mode} />
                    <label className="text-sm font-medium text-ink-soft" htmlFor="acuan">Tanggal acuan (dd/mm/yyyy)</label>
                    <input
                        type="date"
                        id="acuan"
                        name="acuan"
                        className="p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary"
                        defaultValue={d.acuan}
                    />
                    <button className="px-4 py-2 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" type="submit">Terapkan</button>
                </form>

                <div className="overflow-x-auto mt-6">
                    <table className="w-full text-sm text-left border-collapse">
                        <caption className="sr-only">Daftar trip driver</caption>
                        <thead className="bg-surface-2 text-ink-soft">
                            <tr>
                                <th className="px-3 py-2 font-semibold border-b border-line">#</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">No. Order</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Tanggal</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Pemesan</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Unit</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Nopol</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Kota Pelayanan</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Hari</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Nilai Trip</th>
                                <th className="px-3 py-2 font-semibold border-b border-line">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {d.trip.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-3 py-8 text-center text-ink-soft italic">
                                        Belum ada trip pada periode ini.
                                    </td>
                                </tr>
                            )}
                            {d.trip.map((t, i) => (
                                <tr key={`${t.order_id}-${t.nopol}-${i}`} className="hover:bg-surface-2 transition-colors">
                                    <td className="px-3 py-2">{i + 1}</td>
                                    <td className="px-3 py-2 font-mono">
                                        <a href={`/pesanan/${t.order_id}`} className="text-primary hover:underline">{t.nomor_order}</a>
                                    </td>
                                    <td className="px-3 py-2">{tglId(t.tgl_mulai)}</td>
                                    <td className="px-3 py-2">{t.nama_pesanan}</td>
                                    <td className="px-3 py-2">{t.nama_unit}</td>
                                    <td className="px-3 py-2 font-mono">{t.nopol}</td>
                                    <td className="px-3 py-2">{t.kota || "-"}</td>
                                    <td className="px-3 py-2 text-right">{Number(t.jumlah_hari)}</td>
                                    <td className="px-3 py-2 text-right font-medium">{rupiah(t.subtotal_jual, false)}</td>
                                    <td className="px-3 py-2"><BadgeStatus status={t.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                        {d.trip.length > 0 && (
                            <tfoot className="bg-surface-2 font-bold">
                                <tr>
                                    <th colSpan={7} className="px-3 py-2 text-left">TOTAL ({d.totalTrip} trip)</th>
                                    <th className="px-3 py-2 text-right">{d.totalHari}</th>
                                    <th className="px-3 py-2 text-right">{rupiah(d.totalJual, false)}</th>
                                    <th></th>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="mt-6 p-3 bg-surface-2 rounded-lg text-xs text-ink-soft border border-line">
                    Dihitung dari tanggal mulai sewa. Pesanan batal/tertutup tidak dihitung.
                    Nilai trip = harga jual unit/hari &times; jumlah hari (bukan insentif/gaji driver).
                </div>
            </div>
        </>
    );
 }

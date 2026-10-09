import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { rupiah, tglId, sekarangJakarta, normalisasiHp } from "@/lib/format";
import { query } from "@/lib/db";
import { ambilLaporanPenjualan } from "@/lib/laporan-server";
import { SkripMuat } from "@/components/skrip-muat";

/** Satu baris piutang: invoice terbit/sebagian yang masih punya sisa tagihan. */
interface BarisPiutang {
    order_id: number;
    nomor_invoice: string;
    tanggal_invoice: string;
    jatuh_tempo: string | null;
    total: string;
    sisa: string;
    nama_pesanan: string | null;
    hp_pic: string | null;
}
/*
 * Laporan Penjualan — port 1:1 dari resources/views/laporan/penjualan.blade.php
 * + LaporanController::penjualan. HANYA MEMBACA data.
 *
 * Kolom modal/margin datang dari server HANYA bila peran berhak (lihat_modal);
 * markupnya pun baru dibuat kalau datanya ada, jadi angka tidak pernah bocor ke klien.
 */

/** Skrip khusus laporan — Chart.js lokal + penggambar grafik (dari @push('skrip') Blade). */
const SKRIP_LAPORAN = [
    "/assets/vendor/chartjs/chart.umd.min.js",
    "/assets/js/laporan_chart.js?v=20261003a",
];

/** Gaya khas halaman ini — salinan @push('gaya') Blade (.periode-bar/chip/label global di app.css). */
const GAYA_LAPORAN = `
.periode-form { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; margin-bottom:var(--space-2); }
.periode-form label { font-size:.86rem; margin:0; }
.periode-form input[type=date] { max-width:190px; }

/* Bingkai grafik + pemilih sumber/model (chip pakai .periode-chip global). */
.grafik-box { border:1px solid var(--line); border-radius:var(--radius-card); padding:var(--space-3) var(--space-4); margin:var(--space-3) 0 var(--space-4); }
.grafik-judul { font-size:1rem; font-weight:700; margin:0 0 var(--space-1); }
.grafik-pilih { display:flex; flex-wrap:wrap; gap:var(--space-4); }
.grafik-grup { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-1); }
.grafik-label { font-size:.8rem; }
.grafik-kanvas { height:320px; margin-top:var(--space-3); }
`;

export default async function HalamanLaporanPenjualan({
    searchParams,
}: {
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

    const sp = await searchParams;
    const teks = (k: string) => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v ?? "").trim();
    };

    const l = await ambilLaporanPenjualan({ mode: teks("mode"), acuan: teks("acuan") }, user);

    /* Piutang berjalan — hanya untuk peran yang boleh mencatat pembayaran (finance/owner). */
    const bolehPiutang = roleBoleh(user.role, "keuangan.bayar");
    const piutang = bolehPiutang
        ? await query<BarisPiutang>(
            `SELECT i.order_id, i.nomor_invoice, i.tanggal_invoice, i.jatuh_tempo, i.total, i.sisa, o.nama_pesanan, o.hp_pic
             FROM invoices i JOIN orders o ON o.id = i.order_id
             WHERE i.status IN ('terbit', 'sebagian') AND i.sisa > 0
             ORDER BY i.jatuh_tempo IS NULL, i.jatuh_tempo, i.id`,
        )
        : [];
    const totalPiutang = piutang.reduce((a, b) => a + Number(b.sisa), 0);
    /* Rekap per customer — COALESCE menangani order retail tanpa customer_id. */
    const piutangCustomer = bolehPiutang && piutang.length > 0
        ? await query<{ customer: string | null; jml: number; sisa: string }>(
            `SELECT COALESCE(c.nama_pesanan, o.nama_pesanan) customer, COUNT(*) jml, SUM(i.sisa) sisa
             FROM invoices i JOIN orders o ON o.id = i.order_id
             LEFT JOIN customers c ON c.id = o.customer_id
             WHERE i.status IN ('terbit', 'sebagian') AND i.sisa > 0
             GROUP BY COALESCE(c.nama_pesanan, o.nama_pesanan)
             ORDER BY sisa DESC`,
        )
        : [];

    /* Data grafik — bentuk objek sama persis dengan json_encode di Blade. */
    const dataGrafik = {
        mobil: l.perMobil.slice(0, 12).map((m) => ({
            label: (m.nopol + " " + m.nama_unit).trim(),
            nilai: m.jual,
            jumlah: m.trip,
        })),
        armada: l.perJenis.map((j) => ({ label: j.jenis, nilai: j.jual, jumlah: j.trip })),
        kota: l.perKota.slice(0, 12).map((k) => ({ label: k.kota, nilai: k.jual, jumlah: k.jml })),
        reservasi: l.baris.map((b) => ({ label: b.pembuat, nilai: b.jual, jumlah: b.jml })),
    };

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sistem & Tools · Laporan</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Laporan Penjualan</h1>
                <p className="text-ink-soft mt-2">Grafik tren, rekap per armada/kota, dan cetak laporan.</p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: GAYA_LAPORAN }} />

            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                <h2 className="text-xl font-bold text-ink mb-4">Penjualan per reservasi</h2>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                    {Object.entries(l.modePilihan).map(([k, lbl]) => (
                        <a
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${l.mode === k ? "bg-primary-fill border-primary-fill text-on-primary" : "bg-surface border-line-strong text-ink-soft hover:bg-surface-2"}`}
                            href={`/laporan/penjualan?mode=${k}&acuan=${l.acuan}`}
                            key={k}
                        >
                            {lbl}
                        </a>
                    ))}
                    <span className="text-xs font-medium text-ink-soft ml-2">{l.labelPeriode}</span>
                </div>

                <form className="flex flex-wrap items-center gap-3 mb-6" method="get" action="/laporan/penjualan">
                    <input type="hidden" name="mode" value={l.mode} />
                    <label className="text-sm font-medium text-ink-soft" htmlFor="acuan">Tanggal acuan (dd/mm/yyyy)</label>
                    <input
                        type="date"
                        id="acuan"
                        name="acuan"
                        className="p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary"
                        defaultValue={l.acuan}
                    />
                    <button className="px-4 py-2 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" type="submit">Terapkan</button>
                </form>

                {!l.lihatSemua && (
                    <div className="p-3 bg-primary-subtle border border-primary rounded-lg text-ink text-sm mb-6">
                        Peran kamu hanya menampilkan penjualan <b className="font-bold">milik sendiri</b>.
                    </div>
                )}

                {/* ===== GRAFIK ===== */}
                <div className="p-4 border border-line rounded-xl bg-surface-2 mb-6">
                    <h3 className="text-lg font-bold text-ink mb-1">Grafik penjualan</h3>
                    <div className="text-sm text-ink-soft mb-4" id="grafikLaporanJudul">Per mobil (BK) — model Batang</div>

                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-ink-soft">Data:</span>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-primary-fill border-primary-fill text-on-primary" data-grafik-sumber="mobil">Per mobil (BK)</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-sumber="armada">Per armada (jenis)</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-sumber="kota">Per kota</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-sumber="reservasi">Per reservasi</button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-ink-soft">Model:</span>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-primary-fill border-primary-fill text-on-primary" data-grafik-model="bar">Batang</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-model="line">Garis</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-model="doughnut">Lingkaran</button>
                            <button type="button" className="px-2 py-1 text-xs font-medium rounded-full border bg-surface border-line-strong text-ink-soft hover:bg-surface-2" data-grafik-model="radar">Radar</button>
                        </div>
                    </div>

                    <div className="h-[320px] mt-4"><canvas id="grafikLaporan" /></div>
                    <div className="hidden p-4 text-center text-sm text-ink-soft" id="grafikLaporanKosong">
                        Belum ada data pada periode ini.
                    </div>
                </div>

                <script
                    type="application/json"
                    id="dataGrafikLaporan"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(dataGrafik) }}
                />

                <div className="overflow-x-auto mt-6">
                    <table className="w-full text-sm text-left border-collapse">
                        <caption className="sr-only">Penjualan per reservasi</caption>
                        <thead className="bg-surface-2 text-ink-soft">
                            <tr>
                                <th className="px-3 py-2 font-semibold border-b border-line">Reservasi</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Jumlah Pesanan</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Jumlah Trip</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Unit Dipakai</th>
                                <th className="px-3 py-2 font-semibold border-b border-line text-right">Nilai Penjualan</th>
                                {l.bolehModal && (
                                    <>
                                        <th className="px-3 py-2 font-semibold border-b border-line text-right">Modal</th>
                                        <th className="px-3 py-2 font-semibold border-b border-line text-right">Margin</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {l.baris.length === 0 && (
                                <tr>
                                    <td colSpan={l.bolehModal ? 7 : 5} className="px-3 py-8 text-center text-ink-soft italic">
                                        Belum ada penjualan pada periode ini.
                                    </td>
                                </tr>
                            )}
                            {l.baris.map((b, i) => (
                                <tr key={`${i}-${b.username}`} className="hover:bg-surface-2 transition-colors">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-ink">{b.pembuat}</div>
                                        <div className="text-xs text-ink-soft">{b.peran}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right">{b.jml}</td>
                                    <td className="px-3 py-2 text-right">{b.trip}</td>
                                    <td className="px-3 py-2 text-right">{b.unit}</td>
                                    <td className="px-3 py-2 text-right font-medium">{rupiah(b.jual, false)}</td>
                                    {l.bolehModal && (
                                        <>
                                            <td className="px-3 py-2 text-right">{rupiah(b.modal ?? 0, false)}</td>
                                            <td className="px-3 py-2 text-right">{rupiah(b.margin ?? 0, false)}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        {l.baris.length > 0 && l.lihatSemua && (
                            <tfoot className="bg-surface-2 font-bold">
                                <tr>
                                    <th className="px-3 py-2 text-left">TOTAL SEMUA RESERVASI</th>
                                    <th className="px-3 py-2 text-right">{l.total.jml}</th>
                                    <th className="px-3 py-2 text-right">{l.total.trip}</th>
                                    <th className="px-3 py-2 text-right">{l.total.unit}</th>
                                    <th className="px-3 py-2 text-right">{rupiah(l.total.jual, false)}</th>
                                    {l.bolehModal && (
                                        <>
                                            <th className="px-3 py-2 text-right">{rupiah(l.total.modal ?? 0, false)}</th>
                                            <th className="px-3 py-2 text-right">{rupiah(l.total.margin ?? 0, false)}</th>
                                        </>
                                    )}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="mt-6 p-3 bg-surface-2 rounded-lg text-xs text-ink-soft border border-line">
                    Dihitung dari tanggal mulai sewa. Pesanan batal/tertutup tidak dihitung.
                    Satu pesanan bisa memakai lebih dari satu unit (jumlah trip = jumlah baris unit).
                    Aturan rekap yang sama dipakai di Beranda supaya angkanya konsisten.
                </div>
            </div>

            <div className="card-box">
                <h2 className="card-title">Kota pelayanan yang paling banyak pesan</h2>
                <div className="form-text mb-2">
                    Kota = kota cabang yang melayani orderan (1000 Nusantara punya cabang di banyak kota).
                    Urut dari yang paling banyak pesanan pada periode ini.
                </div>
                <div className="table-wrap">
                    <table className="tabel kartu-hp">
                        <caption className="visually-hidden">Penjualan per kota pelayanan</caption>
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Kota Pelayanan</th>
                                <th scope="col">Provinsi</th>
                                <th scope="col" className="num">Jumlah Pesanan</th>
                                <th scope="col" className="num">Jumlah Trip</th>
                                <th scope="col" className="num">Unit Dipakai</th>
                                <th scope="col" className="num">Nilai Penjualan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {l.perKota.length === 0 && (
                                <tr>
                                    <td colSpan={7} data-label="">
                                        <div className="table-kosong">Belum ada pesanan pada periode ini.</div>
                                    </td>
                                </tr>
                            )}
                            {l.perKota.map((k, i) => (
                                <tr key={k.kota}>
                                    <td data-label="#">{i + 1}</td>
                                    <td data-label="Kota Pelayanan">{k.kota}</td>
                                    <td data-label="Provinsi">{k.provinsi || "-"}</td>
                                    <td className="num" data-label="Jumlah Pesanan">{k.jml}</td>
                                    <td className="num" data-label="Jumlah Trip">{k.trip}</td>
                                    <td className="num" data-label="Unit Dipakai">{k.unit}</td>
                                    <td className="num" data-label="Nilai Penjualan">{rupiah(k.jual, false)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {l.perKota.length > 0 && l.lihatSemua && (
                            <tfoot>
                                <tr>
                                    <th colSpan={3}>TOTAL</th>
                                    <th className="num">{l.totalKota.jml}</th>
                                    <th className="num">{l.totalKota.trip}</th>
                                    <th className="num">{l.totalKota.unit}</th>
                                    <th className="num">{rupiah(l.totalKota.jual, false)}</th>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <div className="card-box">
                <h2 className="card-title">Penjualan per mobil (armada)</h2>
                <div className="form-text mb-2">
                    Revisi #16. Diurut dari unit dengan penjualan terbesar pada periode ini.
                    {!l.bolehModal && <> Kolom modal &amp; margin hanya terlihat oleh owner/finance.</>}
                </div>
                <div className="table-wrap">
                    <table className="tabel kartu-hp">
                        <caption className="visually-hidden">Penjualan per mobil</caption>
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Unit</th>
                                <th scope="col">Nopol</th>
                                <th scope="col" className="num">Trip</th>
                                <th scope="col" className="num">Hari Pakai</th>
                                <th scope="col" className="num">Nilai Penjualan</th>
                                {l.bolehModal && (
                                    <>
                                        <th scope="col" className="num">Modal</th>
                                        <th scope="col" className="num">Margin</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {l.perMobil.length === 0 && (
                                <tr>
                                    <td colSpan={l.bolehModal ? 8 : 6} data-label="">
                                        <div className="table-kosong">Belum ada unit yang keluar pada periode ini.</div>
                                    </td>
                                </tr>
                            )}
                            {l.perMobil.map((m, i) => (
                                <tr key={`${m.unit_id}-${m.nopol}-${i}`}>
                                    <td data-label="#">{i + 1}</td>
                                    <td data-label="Unit">{m.nama_unit}</td>
                                    <td className="mono" data-label="Nopol">{m.nopol}</td>
                                    <td className="num" data-label="Trip">{m.trip}</td>
                                    <td className="num" data-label="Hari Pakai">{m.hari}</td>
                                    <td className="num" data-label="Nilai Penjualan">{rupiah(m.jual, false)}</td>
                                    {l.bolehModal && (
                                        <>
                                            <td className="num" data-label="Modal">{rupiah(m.modal ?? 0, false)}</td>
                                            <td className="num" data-label="Margin">{rupiah(m.margin ?? 0, false)}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        {l.perMobil.length > 0 && l.bolehModal && (
                            <tfoot>
                                <tr>
                                    <th colSpan={3}>TOTAL</th>
                                    <th className="num">{l.totalMobil.trip}</th>
                                    <th className="num">{l.totalMobil.hari}</th>
                                    <th className="num">{rupiah(l.totalMobil.jual, false)}</th>
                                    <th className="num">{rupiah(l.totalMobil.modal ?? 0, false)}</th>
                                    <th className="num">{rupiah(l.totalMobil.margin ?? 0, false)}</th>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <div className="card-box">
                <h2 className="card-title">Total trip driver</h2>
                <div className="form-text mb-2">Revisi #17. Klik &quot;Detail&quot; untuk melihat daftar trip driver tersebut.</div>
                <div className="table-wrap">
                    <table className="tabel kartu-hp">
                        <caption className="visually-hidden">Total trip driver</caption>
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Driver</th>
                                <th scope="col">Jenjang</th>
                                <th scope="col" className="num">Trip</th>
                                <th scope="col" className="num">Hari</th>
                                <th scope="col" className="num">Unit Berbeda</th>
                                <th scope="col" className="num">Nilai Trip</th>
                                <th scope="col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {l.perDriver.length === 0 && (
                                <tr>
                                    <td colSpan={8} data-label="">
                                        <div className="table-kosong">Belum ada trip driver pada periode ini.</div>
                                    </td>
                                </tr>
                            )}
                            {l.perDriver.map((d, i) => (
                                <tr key={`${d.driver_id}-${d.nama_driver}-${i}`}>
                                    <td data-label="#">{i + 1}</td>
                                    <td data-label="Driver">{d.nama_driver}</td>
                                    <td data-label="Jenjang">{d.jenjang || "-"}</td>
                                    <td className="num" data-label="Trip">{d.trip}</td>
                                    <td className="num" data-label="Hari">{d.hari}</td>
                                    <td className="num" data-label="Unit Berbeda">{d.unit}</td>
                                    <td className="num" data-label="Nilai Trip">{rupiah(d.jual, false)}</td>
                                    <td data-label="">
                                        <a
                                            className="btn btn-sm btn-outline-secondary"
                                            href={`/laporan/driver/${d.driver_id}?mode=${l.mode}&acuan=${l.acuan}`}
                                        >
                                            Detail
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {l.perDriver.length > 0 && (
                            <tfoot>
                                <tr>
                                    <th colSpan={3}>TOTAL</th>
                                    <th className="num">{l.totalDriver.trip}</th>
                                    <th className="num">{l.totalDriver.hari}</th>
                                    <th className="num">-</th>
                                    <th className="num">{rupiah(l.totalDriver.jual, false)}</th>
                                    <th></th>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {bolehPiutang && (
                <div className="card-box">
                    <h2 className="card-title">Piutang (invoice belum lunas)</h2>
                    <div className="form-text mb-2">
                        Invoice terbit/sebagian yang masih punya sisa tagihan, diurut dari jatuh tempo terlama.
                        Lewat jatuh tempo ditandai merah. Klik &quot;Bayar&quot; untuk mencatat pembayaran.
                    </div>
                    {piutangCustomer.length > 0 && (
                        <div className="table-wrap mb-4">
                            <table className="tabel kartu-hp">
                                <caption className="visually-hidden">Rekap piutang per customer</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Customer</th>
                                        <th scope="col" className="num">Jumlah Invoice</th>
                                        <th scope="col" className="num">Total Sisa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {piutangCustomer.map((k) => (
                                        <tr key={k.customer ?? "-"}>
                                            <td data-label="Customer">{k.customer || "-"}</td>
                                            <td className="num" data-label="Jumlah Invoice">{Number(k.jml)}</td>
                                            <td className="num" data-label="Total Sisa"><b>{rupiah(k.sisa, false)}</b></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan={2}>TOTAL</th>
                                        <th className="num">{rupiah(totalPiutang, false)}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    <div className="table-wrap">
                        <table className="tabel kartu-hp">
                            <caption className="visually-hidden">Piutang belum lunas</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Invoice</th>
                                    <th scope="col">Customer</th>
                                    <th scope="col">Tgl Invoice</th>
                                    <th scope="col">Jatuh Tempo</th>
                                    <th scope="col" className="num">Nilai</th>
                                    <th scope="col" className="num">Sisa</th>
                                    <th scope="col"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {piutang.length === 0 && (
                                    <tr>
                                        <td colSpan={7} data-label="">
                                            <div className="table-kosong">Tidak ada piutang berjalan — semua invoice lunas.</div>
                                        </td>
                                    </tr>
                                )}
                                {piutang.map((p) => {
                                    const lewat = p.jatuh_tempo !== null && p.jatuh_tempo < sekarangJakarta();
                                    const digits = normalisasiHp(p.hp_pic).replace(/[^0-9]/g, "");
                                    const pesan = digits === "" ? null : `https://wa.me/${digits}?text=${encodeURIComponent(`Yth ${p.nama_pesanan ?? "-"}, tagihan ${p.nomor_invoice} sisa ${rupiah(p.sisa, false)}, jatuh tempo ${tglId(p.jatuh_tempo)}. Mohon info pembayarannya. Terima kasih.`)}`;
                                    return (
                                        <tr key={p.nomor_invoice}>
                                            <td className="mono" data-label="Invoice">{p.nomor_invoice}</td>
                                            <td data-label="Customer">{p.nama_pesanan || "-"}</td>
                                            <td data-label="Tgl Invoice">{tglId(p.tanggal_invoice)}</td>
                                            <td data-label="Jatuh Tempo">
                                                {tglId(p.jatuh_tempo)}
                                                {lewat && (
                                                    <span className="badge-pill pill-red ml-1">LEWAT</span>
                                                )}
                                            </td>
                                            <td className="num" data-label="Nilai">{rupiah(p.total, false)}</td>
                                            <td className="num" data-label="Sisa"><b>{rupiah(p.sisa, false)}</b></td>
                                            <td data-label="">
                                                {pesan
                                                    ? <a className="btn btn-sm btn-outline-secondary mr-1" target="_blank" rel="noopener noreferrer" href={pesan}>Reminder</a>
                                                    : "- "}
                                                <a className="btn btn-sm btn-outline-secondary" href={`/pesanan/${p.order_id}`}>Bayar</a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {piutang.length > 0 && (
                                <tfoot>
                                    <tr>
                                        <th colSpan={5}>TOTAL PIUTANG</th>
                                        <th className="num">{rupiah(totalPiutang, false)}</th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            <SkripMuat daftar={SKRIP_LAPORAN} />
        </>
    );
}

import { notFound } from "next/navigation";
import { Fragment } from "react";
import { harusMasuk } from "@/lib/sesi";
import { roleBoleh, bolehLihatModal } from "@/lib/akses";
import { ambilOrder, partnerList, daftarBank } from "@/lib/app-lib";
import { getSetting } from "@/lib/settings";
import { daftarBukti, type Payment } from "@/lib/pesanan-aksi-server";
import { query } from "@/lib/db";
import {
    rupiah,
    tglId,
    tglAngka,
    DAFTAR_STATUS,
    statusLabel,
    labelWilayah,
    labelTipePelanggan,
    labelSumber,
    sekarangJakarta,
} from "@/lib/format";
import { BadgeStatus } from "@/components/badge-status";

/*
 * Detail Pesanan — port 1:1 dari pesanan/detail.blade.php.
 * Kelas CSS, urutan elemen, dan teks dipertahankan sama.
 */

interface PesananRow {
    id: number;
    nomor_order: string;
    status: string;
    nama_pesanan: string;
    tgl_mulai: string;
    tgl_finish: string;
    jumlah_hari: number;
    wilayah_pelayanan: string;
    kota: string;
    tipe_pelanggan: string;
    standby_point: string | null;
    flight: string | null;
    jam: string | null;
    jam_koordinasi: number;
    tujuan: string | null;
    keterangan: string | null;
    hp_tamu: string | null;
    asal_user_raw: string | null;
    sumber: string | null;
    handle_by: string | null;
    catatan: string | null;
    nama_pic: string | null;
    data_tamu: string | null;
    hp_pic: string | null;
    customer_alamat: string | null;
    total_modal: number;
    total_jual: number;
    total_tambahan: number;
    grand_total: number;
    margin: number;
    panjar: number;
    laba: number;
    insentif: number;
    laba_bersih: number;
    template_invoice: string | null;
    bank_invoice: string | null;
}

interface InvoiceRow {
    id: number;
    nomor_invoice: string;
    tanggal_invoice: string;
    jatuh_tempo: string | null;
    status: string;
    jenis: string | null;
    final_at: string | null;
    total: number;
    sisa: number;
}

interface RuteRow {
    id: number;
    urutan: number;
    dari: string | null;
    ke: string | null;
    tgl: string | null;
    jam: string | null;
    catatan: string | null;
}

interface LogRow {
    id: number;
    status_lama: string | null;
    status_baru: string;
    catatan: string | null;
    oleh: string | null;
    created_at: string;
}

/** Teks multi-baris -> <br> (PHP nl2br). */
function MultiBaris({ teks }: { teks: string }) {
    const baris = teks.split(/\r\n|\r|\n/);
    return (
        <>
            {baris.map((b, i) => (
                <Fragment key={i}>
                    {i > 0 && <br />}
                    {b}
                </Fragment>
            ))}
        </>
    );
}

/** date('d/m H:i') untuk kolom created_at status_logs. */
function tglJam(createdAt: string): string {
    const m = String(createdAt ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : "-";
}

export default async function HalamanDetailPesanan({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await harusMasuk();
    const { id } = await params;
    const idNum = Number(id) || 0;
    if (idNum <= 0) {
        notFound();
    }

    const order = await ambilOrder(idNum);
    if (!order) {
        /* Controller lama: redirect ke daftar dengan pesan error. */
        notFound();
    }

    const o = order as unknown as PesananRow;
    const items = order.items;
    const includes = order.includes as unknown as Array<{ nama: string }>;
    const biayaOrder = order.biaya as unknown as Array<{ nama: string; nominal: number }>;
    const logs = order.logs as unknown as LogRow[];

    /* invoice aktif = invoice terbaru yang tidak batal (ambilOrder sudah mengurutkan id DESC) */
    const invoices = order.invoices as unknown as InvoiceRow[];
    const invAktif = invoices.length > 0 ? invoices[0] : null;

    let pembayaran: Payment[] = [];
    let dibayar = 0;
    if (invAktif) {
        pembayaran = await daftarBukti(Number(invAktif.id));
        for (const p of pembayaran) {
            dibayar += Number(p.nominal);
        }
    }
    const sisa = invAktif ? Math.max(0, Number(invAktif.total) - dibayar) : 0;

    const rute = await query<RuteRow>(
        "SELECT * FROM order_rute WHERE order_id = ? ORDER BY urutan",
        [idNum],
    );

    const tampilModal = bolehLihatModal(user.role);
    const bankDefault = await getSetting("bank_nama");
    const banks = await daftarBank();
    const incTeks = includes.map((x) => x.nama).join(" + ");

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pesanan · Detail</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Detail Pesanan</h1>
                <p className="text-ink-soft mt-2">Ringkasan lengkap pesanan, unit, rute, biaya, dan invoice.</p>
            </div>

            {invAktif && Number(o.grand_total) !== Number(invAktif.total) && (
                <div className="alert alert-warning mb-6">
                    <b className="font-bold">Perhatian:</b> data pesanan ({rupiah(o.grand_total)}) berbeda dari invoice yang sudah
                    terbit ({rupiah(invAktif.total)}). Kalau perubahan ini memang harus masuk ke dokumen,
                    klik <b className="font-bold">Perbarui Invoice</b> di bawah supaya isi invoice disesuaikan (nomor invoice tetap sama).
                </div>
            )}
            {!invAktif && o.status === "paid" && (
                <div className="p-3 bg-surface-2 border border-line rounded-lg text-sm text-ink-soft mb-6">
                    <b className="font-bold">Data historis.</b> Pesanan ini berasal dari arsip/impor lama dan bertanda <b className="font-bold">Lunas</b> tanpa
                    invoice maupun catatan pembayaran. Tidak dihitung sebagai piutang berjalan dan tidak masuk
                    angka pendapatan dashboard.
                </div>
            )}

            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-lg font-semibold text-ink">{o.nomor_order}</span>
                            <BadgeStatus status={o.status} />
                        </div>
                        <div className="text-sm text-ink-soft">
                            {o.nama_pesanan} &middot; {tglId(o.tgl_mulai)} s/d {tglId(o.tgl_finish)} ({Number(o.jumlah_hari)} hari) &middot;{" "}
                            {labelWilayah(o.wilayah_pelayanan)} {o.kota}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/pesanan/${idNum}/ubah`}>Ubah Data</a>
                        <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/pesanan/${idNum}/teks-wa`}>Salin Teks WA</a>
                        <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href="/pesanan">Kembali ke Daftar</a>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                        <h2 className="text-xl font-bold text-ink mb-4">Data Pelayanan</h2>
                        <dl className="grid grid-cols-1 gap-y-2">
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Tipe Pelanggan</dt><dd className="text-sm font-medium">{labelTipePelanggan(o.tipe_pelanggan)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Standby Point</dt><dd className="text-sm font-medium">{o.standby_point || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Flight</dt><dd className="text-sm font-medium">{o.flight || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Jam</dt><dd className="text-sm font-medium">{o.jam_koordinasi ? "Koordinasi dengan user" : o.jam || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Tujuan / Rute</dt><dd className="text-sm font-medium">{o.tujuan || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Support By</dt><dd className="text-sm font-medium">{partnerList(order) || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Include</dt><dd className="text-sm font-medium">{incTeks || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Keterangan</dt><dd className="text-sm font-medium">{o.keterangan || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">No. Telepon Tamu <span className="text-ink-faint text-xs">(internal)</span></dt>
                                <dd className="text-sm font-medium">{o.hp_tamu || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Asal User (arsip)</dt>
                                <dd className="text-sm font-medium">
                                    {o.asal_user_raw || "-"}
                                    {o.asal_user_raw ? (
                                        <>
                                            {" "}
                                            <span className="text-ink-faint text-xs">
                                                &rarr; {labelTipePelanggan(o.tipe_pelanggan)} / {labelSumber(String(o.sumber))}
                                            </span>
                                        </>
                                    ) : null}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-sm text-ink-soft">Handle By</dt><dd className="text-sm font-medium">{o.handle_by || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-t border-line pt-2 mt-2">
                                <dt className="text-sm text-ink-soft">Sumber Order</dt><dd className="text-sm font-medium">{o.sumber ? labelSumber(o.sumber) : "-"}</dd>
                            </div>
                            <div className="flex flex-col gap-1 mt-2">
                                <dt className="text-sm text-ink-soft">Catatan</dt>
                                <dd className="text-sm font-medium">{o.catatan ? <MultiBaris teks={o.catatan} /> : "-"}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                        <h2 className="text-xl font-bold text-ink mb-4">Customer &amp; PIC</h2>
                        <dl className="grid grid-cols-1 gap-y-2">
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Nama Pesanan</dt><dd className="text-sm font-medium">{o.nama_pesanan}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">PIC</dt><dd className="text-sm font-medium">{o.nama_pic || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">Data Tamu <span className="text-ink-faint text-xs">(internal)</span></dt><dd className="text-sm font-medium">{o.data_tamu || "-"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-line pb-1">
                                <dt className="text-sm text-ink-soft">HP / WA PIC</dt>
                                <dd className="text-sm font-medium">
                                    {o.hp_pic ? (
                                        <a
                                            href={`https://wa.me/${String(o.hp_pic).replace(/[^0-9]/g, "")}`}
                                            target="_blank"
                                            rel="noopener"
                                            className="text-primary hover:underline"
                                        >
                                            {o.hp_pic}
                                        </a>
                                    ) : (
                                        "-"
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-sm text-ink-soft">Alamat</dt><dd className="text-sm font-medium">{o.customer_alamat || "-"}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="card-box">
                        <h2 className="card-title">Customer &amp; PIC</h2>
                        <dl className="dl-2">
                            <dt>Nama Pesanan</dt><dd>{o.nama_pesanan}</dd>
                            <dt>PIC</dt><dd>{o.nama_pic || "-"}</dd>
                            <dt>Data Tamu <span className="text-soft">(internal)</span></dt><dd>{o.data_tamu || "-"}</dd>
                            <dt>HP / WA PIC</dt>
                            <dd>
                                {o.hp_pic ? (
                                    <a
                                        href={`https://wa.me/${String(o.hp_pic).replace(/[^0-9]/g, "")}`}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        {o.hp_pic}
                                    </a>
                                ) : (
                                    "-"
                                )}
                            </dd>
                            <dt>Alamat</dt><dd>{o.customer_alamat || "-"}</dd>
                        </dl>
                    </div>

                    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                        <h2 className="text-xl font-bold text-ink mb-4">Unit &amp; Driver</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <caption className="sr-only">Unit pesanan</caption>
                                <thead className="bg-surface-2 text-ink-soft">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold border-b border-line">Unit</th>
                                        <th className="px-3 py-2 font-semibold border-b border-line">Nopol</th>
                                        <th className="px-3 py-2 font-semibold border-b border-line">Driver</th>
                                        <th className="px-3 py-2 font-semibold border-b border-line text-right">Hari</th>
                                        {tampilModal && <th className="px-3 py-2 font-semibold border-b border-line text-right">Modal/hari</th>}
                                        <th className="px-3 py-2 font-semibold border-b border-line text-right">Jual/hari</th>
                                        <th className="px-3 py-2 font-semibold border-b border-line text-right">Subtotal jual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {items.map((it) => (
                                        <tr key={Number(it.id)} className="hover:bg-surface-2 transition-colors">
                                            <td className="px-3 py-2">
                                                {it.nama_unit}
                                                {it.upgrade ? <div className="text-[10px] text-ink-soft">Upgrade: {it.upgrade}</div> : null}
                                            </td>
                                            <td className="px-3 py-2 font-mono">{it.nopol}</td>
                                            <td className="px-3 py-2">
                                                {it.nama_driver || "-"}
                                                {it.hp_driver ? <div className="text-[10px] text-ink-soft">{it.hp_driver}</div> : null}{" "}
                                                {it.partner_nama ? <div className="text-[10px] text-ink-soft">Support: {it.partner_nama}</div> : null}
                                            </td>
                                            <td className="px-3 py-2 text-right">{Number(it.jumlah_hari)}</td>
                                            {tampilModal && (
                                                <td className="px-3 py-2 text-right">
                                                    {rupiah(it.harga_modal_per_hari, false)}
                                                </td>
                                            )}
                                            <td className="px-3 py-2 text-right">
                                                {rupiah(it.harga_jual_per_hari, false)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">
                                                {rupiah(it.subtotal_jual, false)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {biayaOrder.length > 0 && (
                            <div className="mt-6">
                                <div className="text-sm font-semibold text-ink-soft mb-2">Biaya Tambahan</div>
                                <div className="space-y-1">
                                    {biayaOrder.map((b, i) => (
                                        <div className="flex justify-between text-sm border-b border-line pb-1 last:border-0" key={i}>
                                            <span className="text-ink-soft">{b.nama}</span><span className="font-medium">{rupiah(b.nominal)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                    {/* Revisi #10: rute perjalanan (bisa ditambah berkali-kali di form) */}
                    {rute.length > 0 && (
                        <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                            <h2 className="text-xl font-bold text-ink mb-4">Rute Perjalanan ({rute.length})</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <caption className="sr-only">Rute perjalanan</caption>
                                    <thead className="bg-surface-2 text-ink-soft">
                                        <tr>
                                            <th className="px-3 py-2 font-semibold border-b border-line">#</th><th className="px-3 py-2 font-semibold border-b border-line">Dari</th><th className="px-3 py-2 font-semibold border-b border-line">Ke</th><th className="px-3 py-2 font-semibold border-b border-line">Tanggal</th><th className="px-3 py-2 font-semibold border-b border-line">Jam</th><th className="px-3 py-2 font-semibold border-b border-line">Catatan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {rute.map((rt) => (
                                            <tr key={Number(rt.id)} className="hover:bg-surface-2 transition-colors">
                                                <td className="px-3 py-2">{Number(rt.urutan)}</td>
                                                <td className="px-3 py-2">{rt.dari || "-"}</td>
                                                <td className="px-3 py-2">{rt.ke || "-"}</td>
                                                <td className="px-3 py-2">{rt.tgl ? tglId(rt.tgl) : "-"}</td>
                                                <td className="px-3 py-2">{rt.jam || "-"}</td>
                                                <td className="px-3 py-2">{rt.catatan || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                        <h2 className="text-xl font-bold text-ink mb-4">Ringkasan Biaya</h2>
                        <div className="space-y-2">
                            {tampilModal && (
                                <div className="flex justify-between text-sm border-b border-line pb-1">
                                    <span className="text-ink-soft">Subtotal modal (internal)</span><span className="font-medium">{rupiah(o.total_modal)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm border-b border-line pb-1">
                                <span className="text-ink-soft">Subtotal jual</span><span className="font-medium">{rupiah(o.total_jual)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-b border-line pb-1">
                                <span className="text-ink-soft">Biaya tambahan</span><span className="font-medium">{rupiah(o.total_tambahan)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-ink border-b border-line pb-2 mt-2">
                                <span>Total Tagihan</span><span>{rupiah(o.grand_total)}</span>
                            </div>
                            {Number(o.panjar ?? 0) > 0 && (
                                <>
                                    <div className="flex justify-between text-sm border-b border-line pb-1">
                                        <span className="text-ink-soft">Panjar (DP awal)</span><span className="font-medium">{rupiah(o.panjar)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-ink border-b border-line pb-2 mt-2">
                                        <span>Sisa Tagihan</span>
                                        <span>{rupiah(Math.max(0, Number(o.grand_total) - Number(o.panjar)))}</span>
                                    </div>
                                </>
                            )}
                            {tampilModal && (
                                <div className="flex justify-between text-sm border-b border-line pb-1">
                                    <span className="text-ink-soft">Margin (internal)</span><span className="font-medium">{rupiah(o.margin)}</span>
                                </div>
                            )}
                            {tampilModal && (Number(o.laba ?? 0) || Number(o.insentif ?? 0) || Number(o.laba_bersih ?? 0)) ? (
                                <>
                                    <div className="flex justify-between text-sm border-b border-line pb-1">
                                        <span className="text-ink-soft">Laba (dari arsip)</span><span className="font-medium">{rupiah(o.laba ?? 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b border-line pb-1">
                                        <span className="text-ink-soft">Insentif (2,75%)</span><span className="font-medium">{rupiah(o.insentif ?? 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-ink border-b border-line pb-2 mt-2">
                                        <span>Laba Bersih</span><span>{rupiah(o.laba_bersih ?? 0)}</span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                        {Number(o.panjar ?? 0) > 0 && (
                            <div className="text-xs text-ink-soft mt-4">
                                Panjar dari form otomatis jadi DP saat Terbitkan Invoice — tidak perlu input lagi di bawah.
                            </div>
                        )}
                    </div>

                    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                        <h2 className="text-xl font-bold text-ink mb-4">Invoice</h2>
                        {!invAktif ? (
                            <>
                                <p className="text-sm text-ink-soft">Invoice belum diterbitkan. Setelah diterbitkan, nomor invoice terkunci.</p>
                                <div className="flex gap-2 mt-4">
                                    <form method="post" action={`/pesanan/${idNum}/aksi`} data-konfirmasi="Terbitkan invoice untuk pesanan ini?">
                                        <input type="hidden" name="id" value={idNum} />
                                        <input type="hidden" name="aksi" value="terbit" />
                                        <button className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors" type="submit">Terbitkan Invoice</button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                    <dt className="text-sm text-ink-soft">Nomor</dt><dd className="text-sm font-mono font-medium">{invAktif.nomor_invoice}</dd>
                                    <dt className="text-sm text-ink-soft">Tanggal</dt><dd className="text-sm font-medium">{tglId(invAktif.tanggal_invoice)}</dd>
                                    <dt className="text-sm text-ink-soft">Jatuh Tempo</dt><dd className="text-sm font-medium">{tglId(invAktif.jatuh_tempo)}</dd>
                                    <dt className="text-sm text-ink-soft">Status</dt><dd className="text-sm"><BadgeStatus status={invAktif.status} /></dd>
                                    <dt className="text-sm text-ink-soft">Jenis</dt>
                                    <dd className="text-sm">
                                        {(invAktif.jenis ?? "sementara") === "final" ? (
                                            <>
                                                <span className="badge-pill pill-amber">FINAL</span>
                                                {invAktif.final_at ? <span className="text-ink-faint ml-1"> {tglId(invAktif.final_at)}</span> : null}
                                            </>
                                        ) : (
                                            <>
                                                <span className="badge-pill pill-slate">SEMENTARA</span>
                                                <span className="text-ink-faint ml-1"> (belum final)</span>
                                            </>
                                        )}
                                    </dd>
                                    <dt className="text-sm text-ink-soft">Total</dt><dd className="text-sm font-medium">{rupiah(invAktif.total)}</dd>
                                    <dt className="text-sm text-ink-soft">Dibayar</dt><dd className="text-sm font-medium">{rupiah(dibayar)}</dd>
                                    <dt className="text-sm text-ink-soft">Sisa</dt><dd className="text-sm font-bold">{rupiah(sisa)}</dd>
                                </dl>
                                <div className="flex flex-wrap gap-2 mt-6">
                                    <a className="px-3 py-1.5 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-xs font-medium transition-colors" href={`/invoice/${Number(invAktif.id)}/cetak`} target="_blank" rel="noopener">Cetak Invoice</a>
                                    {roleBoleh(user.role, "invoice.cetak_final") &&
                                        ((invAktif.jenis ?? "sementara") !== "final" ? (
                                            <form method="post" action={`/pesanan/${idNum}/aksi`} data-konfirmasi={`Jadikan invoice ${invAktif.nomor_invoice} sebagai FINAL? Nomor invoice TETAP SAMA, hanya statusnya yang berubah.`}>
                                                <input type="hidden" name="id" value={idNum} />
                                                <input type="hidden" name="aksi" value="jadikan_final" />
                                                <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" type="submit">Jadikan FINAL</button>
                                            </form>
                                        ) : (
                                            <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/invoice/${Number(invAktif.id)}/cetak`} target="_blank" rel="noopener">Cetak FINAL</a>
                                        ))}
                                    {tampilModal && (
                                        <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/invoice/${Number(invAktif.id)}/cetak?mode=internal`} target="_blank" rel="noopener">Cetak Lembar Internal</a>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                                {/* Aksi perbarui isi dokumen (nomor invoice tetap). */}
                                <div className="baris-aksi mt-2">
                                    <form
                                        method="post"
                                        action={`/pesanan/${idNum}/aksi`}
                                        data-konfirmasi="Perbarui isi invoice dengan data pesanan terbaru? Nomor invoice TETAP SAMA dan di cetak ulang isinya ikut berubah."
                                    >
                                        <input type="hidden" name="id" value={idNum} />
                                        <input type="hidden" name="aksi" value="revisi" />
                                        <button className="btn btn-sm btn-outline-secondary" type="submit">Perbarui Invoice</button>
                                    </form>
                                </div>
                                <div className="border-t border-line mt-6 pt-6">
                                    <div className="text-sm font-medium text-ink-soft mb-3">Opsi Cetak Invoice</div>
                                    <form method="post" action={`/pesanan/${idNum}/aksi`} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                        <input type="hidden" name="id" value={idNum} />
                                        <input type="hidden" name="aksi" value="opsi_cetak" />
                                        <div>
                                            <label className="block text-xs text-ink-soft mb-1" htmlFor="optTemplate">Template Invoice</label>
                                            <select className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="optTemplate" name="template_invoice" defaultValue={o.template_invoice ?? "klasik"}>
                                                <option value="klasik">Klasik (bawaan)</option>
                                                <option value="modern">Modern 1000</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-ink-soft mb-1" htmlFor="optBank">Opsi Bank</label>
                                            <select className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="optBank" name="bank_invoice" defaultValue={o.bank_invoice ?? ""}>
                                                <option value="">Semua bank</option>
                                                {banks.map((b) => (
                                                    <option key={b.nama} value={b.nama}>{b.nama}{b.rekening ? ` — ${b.rekening}` : ""}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button className="px-3 py-2 bg-surface-2 text-ink-soft rounded-lg text-xs font-medium hover:bg-surface-3 transition-colors" type="submit">Simpan</button>
                                    </form>
                                </div>
                                {invAktif && (
                                    <iframe className="w-full h-[600px] rounded-lg border border-line shadow-sm" title="Pratinjau invoice" src={`/invoice/${Number(invAktif.id)}/cetak?embed=1`} />
                                )}
                                <div className="border-t border-line mt-6 pt-6">
                                    <div className="text-sm font-medium text-ink-soft mb-3">Catat Pembayaran</div>
                                    <form method="post" action={`/pesanan/${idNum}/aksi`} encType="multipart/form-data" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <input type="hidden" name="id" value={idNum} />
                                        <input type="hidden" name="aksi" value="bayar" />
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarTanggal">Tanggal</label>
                                            <div className="relative">
                                                <input type="date" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarTanggal" name="tanggal_bayar" defaultValue={sekarangJakarta()} required />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarTipe">Tipe</label>
                                            <select className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarTipe" name="tipe" defaultValue="dp">
                                                <option value="dp">DP</option>
                                                <option value="pelunasan">Pelunasan</option>
                                                <option value="lain">Lainnya</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarNominal">Nominal</label>
                                            <input type="text" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarNominal" name="nominal" placeholder="nominal" defaultValue={sisa > 0 ? rupiah(sisa, false) : ""} required />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarMetode">Metode</label>
                                            <select className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarMetode" name="metode" defaultValue="transfer">
                                                <option value="transfer">Transfer</option>
                                                <option value="cash">Cash</option>
                                                <option value="qris">QRIS</option>
                                                <option value="lain">Lainnya</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarBank">Bank</label>
                                            <input type="text" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarBank" name="bank" defaultValue={bankDefault} placeholder="bank" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarBukti">Bukti</label>
                                            <input type="file" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarBukti" name="bukti" accept=".jpg,.jpeg,.png,.webp,.pdf" />
                                        </div>
                                        <div className="sm:col-span-3 space-y-1">
                                            <label className="block text-xs text-ink-soft" htmlFor="bayarCatatan">Catatan</label>
                                            <input type="text" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-xs text-ink outline-none focus:ring-2 focus:ring-primary" id="bayarCatatan" name="catatan_bayar" placeholder="catatan (opsional)" />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <button className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors" type="submit">Simpan Pembayaran</button>
                                        </div>
                                    </form>
                                    {pembayaran.length > 0 && (
                                        <div className="overflow-x-auto mt-6">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <caption className="sr-only">Riwayat pembayaran</caption>
                                                <thead className="bg-surface-2 text-ink-soft">
                                                    <tr>
                                                        <th className="px-3 py-2 font-semibold border-b border-line">Tgl</th><th className="px-3 py-2 font-semibold border-b border-line">Tipe</th><th className="px-3 py-2 font-semibold border-b border-line text-right">Nominal</th><th className="px-3 py-2 font-semibold border-b border-line">Bukti</th><th className="px-3 py-2 font-semibold border-b border-line"> lajak </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-line">
                                                    {pembayaran.map((p) => (
                                                        <tr key={Number(p.id)} className="hover:bg-surface-2 transition-colors">
                                                            <td className="px-3 py-2">{tglAngka(p.tanggal_bayar)}</td>
                                                            <td className="px-3 py-2">
                                                                {p.tipe.charAt(0).toUpperCase() + p.tipe.slice(1)}
                                                                <div className="text-[10px] text-ink-soft">{p.metode}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-medium">{rupiah(p.nominal, false)}</td>
                                                            <td className="px-3 py-2">
                                                                {p.bukti_path ? <a href={`/pesanan/${p.id}/bukti`} target="_blank" rel="noopener" className="text-primary hover:text-primary-d text-xs underline">lihat</a> : "-"}
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <form method="post" action={`/pesanan/${idNum}/aksi`} data-konfirmasi="Hapus catatan pembayaran ini?">
                                                                    <input type="hidden" name="id" value={idNum} />
                                                                    <input type="hidden" name="aksi" value="hapus_bayar" />
                                                                    <input type="hidden" name="payment_id" value={Number(p.id)} />
                                                                    <button className="px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft rounded transition-colors" type="submit">x</button>
                                                                </form>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                        </div>
            </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-4 space-y-6">
            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                <h2 className="text-xl font-bold text-ink mb-4">Log Status</h2>
                <div className="space-y-3">
                                    {logs.map((l) => (
                                        <div key={Number(l.id)} className="flex gap-3 text-sm">
                                            <div className="text-ink-faint shrink-0">{tglJam(l.created_at)}</div>
                                            <div>
                                                <div className="font-medium text-ink">
                                                    <BadgeStatus status={l.status_baru} /> {l.catatan}
                                                </div>
                                                <div className="text-xs text-ink-soft">Oleh: {l.oleh}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-sm text-ink-soft">Belum ada riwayat.</div>}
                </div>
            </div>
        </div>
        <div className="lg:col-span-8 space-y-6">
            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                <h2 className="text-xl font-bold text-ink mb-4">Ubah Status Pesanan</h2>
                <form method="post" action={`/pesanan/${idNum}/aksi`} className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-ink-soft mb-1">Status Baru</label>
                        <select className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-sm text-ink focus:ring-2 focus:ring-primary outline-none transition-all" name="status_baru" aria-label="Status baru">
                            {DAFTAR_STATUS.map((st) => (
                                <option key={st} value={st}>{statusLabel(st)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-ink-soft mb-1">Keterangan</label>
                        <input type="text" className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-sm text-ink focus:ring-2 focus:ring-primary outline-none transition-all" name="catatan_status" placeholder="Contoh: Sudah dikirim" />
                    </div>
                    <button className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors" type="submit">Simpan</button>
                    <input type="hidden" name="id" value={idNum} />
                    <input type="hidden" name="aksi" value="status" />
                </form>
            </div>
        </div>
    </div>
    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mt-6">
        <h2 className="text-xl font-bold text-ink mb-4">Aksi Destruktif</h2>
        <div className="flex flex-wrap gap-3">
            <form method="post" action={`/pesanan/${idNum}/aksi`} data-konfirmasi="Batalkan pesanan ini?">
                <input type="hidden" name="id" value={idNum} />
                <input type="hidden" name="aksi" value="batal" />
                <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-danger-line text-danger hover:bg-danger-soft transition-colors" type="submit">Batalkan Pesanan</button>
            </form>
            <form method="post" action={`/pesanan/${idNum}/aksi`} data-konfirmasi="Hapus pesanan dari daftar?">
                <input type="hidden" name="id" value={idNum} />
                <input type="hidden" name="aksi" value="hapus" />
                <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-danger-line text-danger hover:bg-danger-soft transition-colors" type="submit">Hapus</button>
            </form>
        </div>
    </div>
    <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mt-6">
        <h2 className="text-xl font-bold text-ink mb-4">Riwayat Status</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <caption className="sr-only">Log pesanan</caption>
                <thead className="bg-surface-2 text-ink-soft">
                                    <tr><th className="px-3 py-2 font-semibold border-b border-line">Waktu</th><th className="px-3 py-2 font-semibold border-b border-line">Dari</th><th className="px-3 py-2 font-semibold border-b border-line">Ke</th><th className="px-3 py-2 font-semibold border-b border-line">Oleh</th></tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {logs.length === 0 && (
                                        <tr className="text-center">
                                            <td colSpan={4} className="py-4 text-sm text-ink-soft">Belum ada riwayat.</td>
                                        </tr>
                                    )}
                                    {logs.map((lg) => (
                                        <tr key={Number(lg.id)} className="hover:bg-surface-2 transition-colors">
                                            <td className="px-3 py-2">{tglJam(lg.created_at)}</td>
                                            <td className="px-3 py-2">{lg.status_lama ? statusLabel(lg.status_lama) : "-"}</td>
                                            <td className="px-3 py-2">
                                                {statusLabel(lg.status_baru)}
                                                {lg.catatan ? <div className="text-[10px] text-ink-soft">{lg.catatan}</div> : null}
                                            </td>
                                            <td className="px-3 py-2">{lg.oleh}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
        </>
    );
 }

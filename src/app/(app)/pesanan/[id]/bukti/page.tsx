import { notFound } from "next/navigation";
import path from "node:path";
import fs from "node:fs";
import { harusMasuk } from "@/lib/sesi";
import { ambilOrder } from "@/lib/app-lib";
import { daftarBukti, type Payment } from "@/lib/pesanan-aksi-server";
import { queryOne } from "@/lib/db";
import { rupiah, tglAngka } from "@/lib/format";

/*
 * Bukti pembayaran — port dari pesanan/bukti.blade.php (asal systems lama pages/bukti.php).
 * {id} adalah ID PEMBAYARAN (payments.id); bila bukan id pembayaran, dicoba
 * sebagai id pesanan dan yang tampil adalah daftar seluruh buktinya.
 */

interface Invoice {
    id: number;
    order_id: number;
    nomor_invoice: string;
}

/** Modal awal huruf: PHP ucfirst(). */
function ucfirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Apakah berkas bukti benar-benar ada di public/? */
function berkasAda(relatif: string | null | undefined): boolean {
    if (!relatif) {
        return false;
    }
    try {
        return fs.statSync(path.join(process.cwd(), "public", relatif)).isFile();
    } catch {
        return false;
    }
}

export default async function HalamanBukti({ params }: { params: Promise<{ id: string }> }) {
    await harusMasuk();
    const { id } = await params;
    const idNum = Number(id) || 0;
    if (idNum <= 0) {
        notFound();
    }

    const payment = await queryOne<Payment>("SELECT * FROM payments WHERE id = ? LIMIT 1", [idNum]);
    const isPayment = payment !== null;

    let invoice: Invoice | null = null;
    let order: Awaited<ReturnType<typeof ambilOrder>> = null;
    let daftar: Payment[] = [];

    if (payment) {
        invoice = await queryOne<Invoice>("SELECT * FROM invoices WHERE id = ? LIMIT 1", [Number(payment.invoice_id)]);
        if (invoice) {
            order = await ambilOrder(Number(invoice.order_id));
            daftar = await daftarBukti(Number(invoice.id));
        }
    } else {
        /* Bukan id pembayaran: coba sebagai id pesanan -> daftar bukti pesanan. */
        order = await ambilOrder(idNum);
        if (order) {
            const invIds = (order.invoices as unknown as Array<{ id: number }>).map((x) => Number(x.id));
            if (invIds.length > 0) {
                daftar = await daftarBukti(invIds[0]);
                const semua: Payment[] = [];
                for (const invId of invIds) {
                    semua.push(...(await daftarBukti(invId)));
                }
                daftar = semua;
                invoice = await queryOne<Invoice>("SELECT * FROM invoices WHERE id = ? LIMIT 1", [invIds[0]]);
            }
        }
    }

    if (!isPayment && !order) {
        notFound();
    }

    const pathBukti = payment?.bukti_path ?? "";
    const ada = berkasAda(pathBukti);
    const ext = ada ? (pathBukti.split(".").pop() ?? "").toLowerCase() : "";
    const nomorInv = invoice?.nomor_invoice ?? null;
    const gambar = ["jpg", "jpeg", "png", "webp"];

    return (
        <>
            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-ink mb-1">Bukti Pembayaran</h2>
                        <div className="text-sm text-ink-soft">
                            {nomorInv && (
                                <>
                                    Invoice <span className="font-mono font-medium">{nomorInv}</span> &middot;
                                </>
                            )}{" "}
                            {order && (
                                <>
                                    {String(order.nomor_order)} &middot; {String(order.nama_pesanan)}
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {order && (
                            <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/pesanan/${Number(order.id)}`}>
                                Kembali ke Detail
                                </a>
                            )}
                    </div>
                </div>
            </div>

            {payment && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                    <div className="lg:col-span-5">
                        <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                            <h2 className="text-xl font-bold text-ink mb-4">Catatan Pembayaran</h2>
                            <dl className="grid grid-cols-1 gap-y-2">
                                <div className="flex justify-between border-b border-line pb-1">
                                    <dt className="text-sm text-ink-soft">Tanggal</dt><dd className="text-sm font-medium">{tglAngka(payment.tanggal_bayar)}</dd>
                                </div>
                                <div className="flex justify-between border-b border-line pb-1">
                                    <dt className="text-sm text-ink-soft">Tipe</dt><dd className="text-sm font-medium">{ucfirst(payment.tipe)}</dd>
                                </div>
                                <div className="flex justify-between border-b border-line pb-1">
                                    <dt className="text-sm text-ink-soft">Nominal</dt><dd className="text-sm font-bold">{rupiah(payment.nominal)}</dd>
                                </div>
                                <div className="flex justify-between border-b border-line pb-1">
                                    <dt className="text-sm text-ink-soft">Metode</dt><dd className="text-sm font-medium">{ucfirst(payment.metode)}</dd>
                                </div>
                                <div className="flex justify-between border-b border-line pb-1">
                                    <dt className="text-sm text-ink-soft">Bank</dt><dd className="text-sm font-medium">{payment.bank || "-"}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-sm text-ink-soft">Catatan</dt><dd className="text-sm font-medium text-right">{payment.catatan || "-"}</dd>
                                </div>
                            </dl>

                            <div className="mt-6 pt-6 border-t border-line">
                                <label className="block text-sm font-medium text-ink-soft mb-2">Unggah / Ganti Berkas Bukti</label>
                                <form
                                    method="post"
                                    action={`/pesanan/${payment.id}/bukti/unggah`}
                                    encType="multipart/form-data"
                                    className="flex gap-2"
                                >
                                    <input
                                        type="file"
                                        className="flex-1 p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary"
                                        name="bukti"
                                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                                        required
                                    />
                                    <button className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors" type="submit">Simpan</button>
                                </form>
                                <div className="text-xs text-ink-soft mt-2">Jenis berkas JPG/PNG/WEBP/PDF, ukuran maksimal 5 MB.</div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                            <h2 className="text-xl font-bold text-ink mb-4">Berkas Bukti</h2>
                            <div className="rounded-lg overflow-hidden border border-line bg-surface-2 min-h-[300px] flex items-center justify-center">
                                {ada && gambar.includes(ext) ? (
                                    /* Bukti pembayaran unggahan pengguna: jalur dinamis di
                                       /uploads, bukan aset statis yang bisa dioptimasi. */
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img className="max-w-full max-h-full" src={`/${pathBukti}`} alt="Bukti pembayaran" />
                                ) : ada && ext === "pdf" ? (
                                    <iframe className="w-full h-[600px]" title="Bukti pembayaran" src={`/${pathBukti}`} />
                                ) : ada ? (
                                    <div className="text-center p-6">
                                        <p className="text-sm text-ink-soft mb-4">Berkas tidak dapat dipratinjau.</p>
                                        <a href={`/${pathBukti}`} target="_blank" rel="noopener" className="text-sm font-medium text-primary hover:underline">Buka berkas</a>
                                    </div>
                                ) : (
                                    <div className="text-center p-6">
                                        <p className="text-sm text-ink-soft">Belum ada berkas bukti untuk pembayaran ini.</p>
                                    </div>
                                )}
                            </div>
                            {ada && (
                                <div className="mt-4 flex justify-end">
                                    <a className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/${pathBukti}`} target="_blank" rel="noopener">
                                        Buka di Tab Baru
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

                <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mt-6">
                    <h2 className="text-xl font-bold text-ink mb-4">Daftar Bukti</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <caption className="sr-only">Daftar bukti pembayaran</caption>
                            <thead className="bg-surface-2 text-ink-soft">
                                <tr>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Tgl</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Tipe</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line text-right">Nominal</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Metode</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Bukti</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {daftar.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-ink-soft italic">
                                            Belum ada catatan pembayaran.
                                        </td>
                                    </tr>
                                )}
                                {daftar.map((p) => (
                                    <tr key={Number(p.id)} className="hover:bg-surface-2 transition-colors">
                                        <td className="px-3 py-2">{tglAngka(p.tanggal_bayar)}</td>
                                        <td className="px-3 py-2">{ucfirst(p.tipe)}</td>
                                        <td className="px-3 py-2 text-right font-medium">{rupiah(p.nominal, false)}</td>
                                        <td className="px-3 py-2">{ucfirst(p.metode)}</td>
                                        <td className="px-3 py-2">
                                            {p.bukti_path ? (
                                                <a
                                                    href={`/pesanan/${p.id}/bukti`}
                                                    className="text-xs text-primary hover:underline"
                                                    {...(!payment || Number(payment.id) !== Number(p.id)
                                                        ? { target: "_blank", rel: "noopener" }
                                                        : {})}
                                                >
                                                    lihat
                                                </a>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
        </>
    );
 }

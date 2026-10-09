import { tglSingkat, rupiah } from "@/lib/format";
import { partnerList, terbilang } from "@/lib/app-lib";
import { escapeHtml, nl2br, type DataCetak } from "@/lib/invoice-cetak-server";
import { CSS_KLASIK } from "./_css-klasik";
import { TombolCetakKlasik } from "./_tombol";

/*
 * Template invoice "klasik" — port 1:1 dari
 * legacy-laravel/resources/views/invoice/cetak.blade.php.
 *
 * Struktur, urutan kolom, class CSS, dan teks dipertahankan persis (dokumen cetak).
 * Dua <img> ditulis lewat dangerouslySetInnerHTML supaya atribut `onerror`
 * (cadangan bila berkas logo/tanda tangan hilang) ikut terbawa seperti Blade;
 * URL-nya di-escape dulu, jadi tidak ada HTML dari pengguna yang disuntikkan.
 */

export function InvoiceKlasik({
    d,
    mode,
    embed,
}: {
    d: DataCetak;
    mode: "internal" | "customer";
    embed: boolean;
}) {
    const internal = mode === "internal";
    const set = (k: string, def = "") => d.setelan[k] || def;
    const maxRow = Math.max(d.items.length, 3);
    const kolomTotal = internal ? 7 : 6;
    const nomorBayar = d.dpSum > 0 ? `Rp ${rupiah(d.dpSum, false)}` : "-";

    /* Sama seperti Blade: penghitung baris untuk kolom Modal/Hari (lembar internal). */
    let idx = 0;

    const logoHtml = `<img src="${escapeHtml("/" + set("logo").replace(/^\/+/, ""))}" alt="Logo" onerror="this.style.display='none'">`;
    const ttdHtml = `<img src="${escapeHtml("/" + set("ttd").replace(/^\/+/, ""))}" alt="Tanda Tangan" onerror="this.parentElement.innerHTML='<br><br><br>'">`;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: CSS_KLASIK }} />
            <div className={`inv-root${embed ? " embed" : ""}`}>
                <div className="no-print">
                    <TombolCetakKlasik />
                    <a className="abu" href={`/pesanan/${Number(d.order.id)}`}>Kembali ke Pesanan</a>
                    {mode === "customer" ? (
                        <a className="abu" href={`?id=${d.inv.id}&mode=internal`}>Lihat Lembar Internal</a>
                    ) : (
                        <a className="abu" href={`?id=${d.inv.id}`}>Lihat Versi Customer</a>
                    )}
                </div>

                <div className="invoice-page">
                    {d.batal && <div className="watermark">BATAL</div>}

                    <div className="header">
                        <div className="header-left" dangerouslySetInnerHTML={{ __html: logoHtml }} />
                        <div className="header-right">
                            <div className="invoice-title">INVOICE</div>
                            <div className="company-name">{d.namaPT}</div>
                            <div className="company-info">
                                {set("website_pt")} {set("email_pt")}<br />
                                {set("email_pt2")}
                            </div>
                        </div>
                    </div>

                    {internal && (
                        <div className="tanda-internal">LEMBAR ORDER INTERNAL &mdash; TIDAK UNTUK CUSTOMER</div>
                    )}

                    <div className="info-section">
                        <div className="info-left">
                            <div className="label">DITAGIH KEPADA</div>
                            <div className="client-name">
                                {String(d.custSnap.nama ?? d.order.nama_pesanan ?? "")}<br />
                                {String(d.custSnap.pic ?? (d.order.nama_pic || ""))}
                            </div>
                        </div>
                        <div className="info-right">
                            <table>
                                <tbody>
                                    <tr>
                                        <td>No. Faktur</td><td className="colon">:</td>
                                        <td>{d.inv.nomor_invoice}</td>
                                    </tr>
                                    <tr>
                                        <td>Tanggal</td><td className="colon">:</td>
                                        <td>{tglSingkat(d.inv.tanggal_invoice)}</td>
                                    </tr>
                                    <tr>
                                        <td>Jatuh Tempo</td><td className="colon">:</td>
                                        <td>{tglSingkat(d.inv.jatuh_tempo)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <table className="main-table">
                        <thead>
                            <tr>
                                <th className="col-no">No.</th>
                                <th className="col-ket">Keterangan</th>
                                <th className="col-driver">Driver</th>
                                <th className="col-tgl">Tanggal<br />Pemakaian</th>
                                <th className="col-rute">Rute Perjalanan /<br />Keterangan</th>
                                <th className="col-harga">Harga/Hari<br />(Rp.)</th>
                                {internal && <th className="col-modal">Modal/Hari<br />(Rp.)</th>}
                                <th className="col-hari">Total<br />Hari</th>
                                <th className="col-total">Total Harga</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: maxRow }, (_, i) => {
                                const it = d.items[i];
                                if (!it) {
                                    return (
                                        <tr className="empty-row" key={`kosong-${i}`}>
                                            <td className="col-no">&nbsp;</td>
                                            <td className="col-ket">&nbsp;</td>
                                            <td className="col-driver">&nbsp;</td>
                                            <td className="col-tgl">&nbsp;</td>
                                            <td className="col-rute">&nbsp;</td>
                                            <td className="col-harga">&nbsp;</td>
                                            {internal && <td className="col-modal">&nbsp;</td>}
                                            <td className="col-hari">&nbsp;</td>
                                            <td className="col-total">&nbsp;</td>
                                        </tr>
                                    );
                                }
                                const gaya = i > 0 ? { borderTop: "1px solid #000" } : undefined;
                                const modal = internal ? Number(d.order.items[idx]?.harga_modal_per_hari ?? 0) : 0;
                                if (internal) {
                                    idx++;
                                }
                                return (
                                    <tr className="data-row" style={gaya} key={Number(it.id)}>
                                        <td className="col-no" style={gaya}>{Number(it.no)}</td>
                                        <td className="col-ket" style={gaya} dangerouslySetInnerHTML={{ __html: nl2br(it.keterangan) }} />
                                        <td className="col-driver" style={gaya} dangerouslySetInnerHTML={{ __html: nl2br(it.driver) }} />
                                        <td className="col-tgl" style={gaya}>{it.tanggal_pakai}</td>
                                        <td className="col-rute" style={gaya} dangerouslySetInnerHTML={{ __html: nl2br(it.rute) }} />
                                        <td className="col-harga" style={gaya}>Rp {rupiah(it.harga_hari, false)}</td>
                                        {internal && <td className="col-modal" style={gaya}>{rupiah(modal, false)}</td>}
                                        <td className="col-hari" style={gaya}>{Number(it.total_hari)}</td>
                                        <td className="col-total" style={gaya}>Rp {rupiah(it.total_harga, false)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={kolomTotal} className="label-cell">Total</td>
                                <td className="hari-cell">-</td>
                                <td className="amount-cell">Rp {rupiah(d.totalInv, false)}</td>
                            </tr>
                            <tr>
                                <td colSpan={kolomTotal} className="label-cell">Down Payment</td>
                                <td className="hari-cell">-</td>
                                <td className="amount-cell">{nomorBayar}</td>
                            </tr>
                            <tr>
                                <td colSpan={kolomTotal} className="label-cell">Total Yang Harus Di Bayar</td>
                                <td className="hari-cell">-</td>
                                <td className="amount-cell">Rp {rupiah(d.sisa, false)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="terbilang">
                        <span className="label">Terbilang :</span> {terbilang(d.sisa)} Rupiah
                    </div>

                    {internal && (
                        <div className="internal-box">
                            <table>
                                <tbody>
                                    <tr><td>Total modal unit</td><td className="num">Rp {rupiah(Number(d.order.total_modal ?? 0), false)}</td></tr>
                                    <tr><td>Biaya tambahan</td><td className="num">Rp {rupiah(Number(d.order.total_tambahan ?? 0), false)}</td></tr>
                                    <tr>
                                        <td><b>Margin</b></td>
                                        <td className="num"><b>Rp {rupiah(Number(d.order.margin ?? 0), false)}</b></td>
                                    </tr>
                                    <tr><td>Support By / partner</td><td className="num">{partnerList(d.order) || "-"}</td></tr>
                                    <tr><td>Handle By</td><td className="num">{String(d.order.handle_by ?? "") || "-"}</td></tr>
                                    {Boolean(d.order.catatan) && (
                                        <tr><td>Catatan</td><td className="num">{String(d.order.catatan)}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="footer">
                        <div className="footer-left">
                            <div className="catatan-title">CATATAN</div>
                            <span dangerouslySetInnerHTML={{ __html: nl2br(set("catatan_bank")) }} />
                        </div>
                        <div className="footer-right">
                            <div className="hormat">Hormat Saya</div>
                            <div className="company">{d.namaPT}</div>
                            <div className="ttd-space" dangerouslySetInnerHTML={{ __html: ttdHtml }} />
                            <div className="nama">{set("penandatangan", "Yuswanto SH")}</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

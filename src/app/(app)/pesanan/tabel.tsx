import { tglId, potong, rupiah, type Paginasi } from "@/lib/format";
import { BadgeStatus } from "@/components/badge-status";
import type { BarisPesanan } from "@/lib/pesanan-server";

/*
 * Partial tabel + paginasi Data Pesanan — port dari pesanan/_tabel.blade.php.
 * Dipakai render penuh. (htmx digantikan form GET biasa; DOM contract #daftar tetap.)
 */
/** Jendela nomor halaman: selalu 1 & terakhir, current±2, elipsis untuk gap. */
function halamanTampil(hal: number, jumlah: number): Array<number | "…"> {
    if (jumlah <= 7) {
        return Array.from({ length: jumlah }, (_, i) => i + 1);
    }
    const out: Array<number | "…"> = [1];
    const mulai = Math.max(2, hal - 2);
    const akhir = Math.min(jumlah - 1, hal + 2);
    if (mulai > 2) out.push("…");
    for (let i = mulai; i <= akhir; i++) out.push(i);
    if (akhir < jumlah - 1) out.push("…");
    out.push(jumlah);
    return out;
}

export function TabelPesanan({
    rows,
    pg,
    total,
    qs,
}: {
    rows: BarisPesanan[];
    pg: Paginasi;
    total: number;
    qs: (hal: number) => string;
}) {
    return (
        <div className="card-box">
            <h2 className="card-title">{total} pesanan ditemukan</h2>
            <div className="table-wrap">
                <table className="tabel kartu-hp">
                    <caption className="visually-hidden">Daftar pesanan</caption>
                    <thead>
                        <tr>
                            <th scope="col">No. Order</th>
                            <th scope="col">Tanggal</th>
                            <th scope="col">Pesanan</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Status</th>
                            <th scope="col">Invoice</th>
                            <th scope="col" className="num">Total</th>
                            <th scope="col">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} data-label="">
                                    <div className="table-kosong">
                                        Belum ada pesanan yang cocok. Klik &quot;+ Input Pesanan&quot; untuk mulai.
                                    </div>
                                </td>
                            </tr>
                        )}
                        {rows.map((r) => (
                            <tr key={Number(r.id)}>
                                <td className="mono" data-label="No. Order">
                                    {r.nomor_order}
                                    <div className="muted">{r.kota}</div>
                                </td>
                                <td data-label="Tanggal">
                                    {tglId(r.tgl_mulai)}
                                    <div className="muted">{Number(r.jumlah_hari)} hari</div>
                                </td>
                                <td data-label="Pesanan">
                                    {potong(r.nama_pesanan, 40)}
                                    {r.nama_pic ? <div className="muted">{r.nama_pic}</div> : null}
                                </td>
                                <td data-label="Unit">
                                    {potong(String(r.unit_list ?? ""), 28)}
                                    <div className="muted mono">{String(r.nopol_list ?? "")}</div>
                                </td>
                                <td data-label="Status">
                                    <BadgeStatus status={String(r.status)} />
                                </td>
                                <td data-label="Invoice">
                                    {r.nomor_invoice ? (
                                        <>
                                            <span className="mono">{r.nomor_invoice}</span>
                                            <div>
                                                <BadgeStatus status={String(r.inv_status)} />
                                            </div>
                                        </>
                                    ) : (
                                        <span className="muted">
                                            {r.status === "paid" ? "tidak ada — data historis" : "belum terbit"}
                                        </span>
                                    )}
                                </td>
                                <td className="num" data-label="Total">{rupiah(r.grand_total, false)}</td>
                                <td data-label="">
                                    <a className="btn btn-sm btn-outline-secondary" href={`/pesanan/${Number(r.id)}`}>
                                        Detail
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pg.jumlah_halaman > 1 && (
                <nav className="mt-3" aria-label="Paginasi pesanan">
                    <ul className="pagination pagination-sm mb-0">
                        {halamanTampil(pg.halaman, pg.jumlah_halaman).map((h, i) =>
                            h === "…" ? (
                                <li key={`elipsis-${i}`} className="page-item" aria-hidden="true">
                                    <span className="page-link">…</span>
                                </li>
                            ) : (
                                <li key={h} className={`page-item ${h === pg.halaman ? "active" : ""}`}>
                                    <a className="page-link" href={`?${qs(h)}`} aria-current={h === pg.halaman ? "page" : undefined}>{h}</a>
                                </li>
                            )
                        )}
                    </ul>
                </nav>
            )}
        </div>
    );
}

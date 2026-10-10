import { query } from "@/lib/db";
import { rupiah, tglId, sekarangJakarta, normalisasiHp } from "@/lib/format";

/*
 * Piutang berjalan — satu-satunya sumber query + tabel untuk dua pemakai:
 * halaman Keuangan/Piutang dan seksi piutang Laporan Penjualan.
 * Kedua query persis sama dengan query lama masing-masing halaman.
 * HANYA MEMBACA data.
 */

/** Satu baris piutang: invoice terbit/sebagian yang masih punya sisa tagihan. */
export interface BarisPiutang {
    order_id: number;
    nomor_invoice: string;
    tanggal_invoice: string;
    jatuh_tempo: string | null;
    total: string;
    sisa: string;
    nama_pesanan: string | null;
    hp_pic: string | null;
}

/** Rekap piutang per customer. */
export interface RekapPiutang {
    customer: string | null;
    jml: number;
    sisa: string;
}

/** Kedua query piutang + total sisa — dipanggil sekali per halaman. */
export async function ambilPiutang(): Promise<{
    piutang: BarisPiutang[];
    piutangCustomer: RekapPiutang[];
    totalPiutang: number;
}> {
    const piutang = await query<BarisPiutang>(
        `SELECT i.order_id, i.nomor_invoice, i.tanggal_invoice, i.jatuh_tempo, i.total, i.sisa, o.nama_pesanan, o.hp_pic
         FROM invoices i JOIN orders o ON o.id = i.order_id
         WHERE i.status IN ('terbit', 'sebagian') AND i.sisa > 0
         ORDER BY i.jatuh_tempo IS NULL, i.jatuh_tempo, i.id`,
    );
    const totalPiutang = piutang.reduce((a, b) => a + Number(b.sisa), 0);
    /* Rekap per customer — COALESCE menangani order retail tanpa customer_id. */
    const piutangCustomer = await query<RekapPiutang>(
        `SELECT COALESCE(c.nama_pesanan, o.nama_pesanan) customer, COUNT(*) jml, SUM(i.sisa) sisa
         FROM invoices i JOIN orders o ON o.id = i.order_id
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE i.status IN ('terbit', 'sebagian') AND i.sisa > 0
         GROUP BY COALESCE(c.nama_pesanan, o.nama_pesanan)
         ORDER BY sisa DESC`,
    );
    return { piutang, piutangCustomer, totalPiutang };
}

/** Tabel rekap per customer (dengan empty state tetap tampil). */
export function TabelRekapPiutang({
    rows,
    total,
}: {
    rows: RekapPiutang[];
    total: number;
}) {
    return (
        <div className="table-wrap mb-4">
            <table className="tabel kartu-hp">
                <caption className="visually-hidden">Rekap piutang per customer</caption>
                <thead>
                    <tr>
                        <th scope="col">Customer</th>
                        <th scope="col" className="num">Jumlah Invoice</th>
                        <th scope="col" className="num">Sisa Tagihan</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={3} data-label="">
                                <div className="table-kosong">Tidak ada piutang berjalan — semua invoice lunas.</div>
                            </td>
                        </tr>
                    )}
                    {rows.map((k) => (
                        <tr key={k.customer ?? "-"}>
                            <td data-label="Customer">{k.customer || "-"}</td>
                            <td className="num" data-label="Jumlah Invoice">{Number(k.jml)}</td>
                            <td className="num" data-label="Sisa Tagihan"><b>{rupiah(k.sisa, false)}</b></td>
                        </tr>
                    ))}
                </tbody>
                {rows.length > 0 && (
                    <tfoot>
                        <tr>
                            <th colSpan={2}>TOTAL</th>
                            <th className="num">{rupiah(total, false)}</th>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

/** Tabel daftar invoice belum lunas + tombol Reminder WA / Bayar. */
export function TabelDetailPiutang({
    rows,
    total,
}: {
    rows: BarisPiutang[];
    total: number;
}) {
    const hariIni = sekarangJakarta();
    return (
        <div className="table-wrap">
            <table className="tabel kartu-hp">
                <caption className="visually-hidden">Daftar invoice belum lunas</caption>
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
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={7} data-label="">
                                <div className="table-kosong">Tidak ada piutang berjalan — semua invoice lunas.</div>
                            </td>
                        </tr>
                    )}
                    {rows.map((p) => {
                        const lewat = p.jatuh_tempo !== null && p.jatuh_tempo < hariIni;
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
                {rows.length > 0 && (
                    <tfoot>
                        <tr>
                            <th colSpan={5}>TOTAL PIUTANG</th>
                            <th className="num">{rupiah(total, false)}</th>
                            <th></th>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

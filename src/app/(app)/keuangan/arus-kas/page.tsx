import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { query, queryOne } from "@/lib/db";
import { rupiah, tglId, sekarangJakarta } from "@/lib/format";

/** Satu baris pembayaran masuk + invoice dan customer terkait. */
interface BarisArusKas {
    tanggal_bayar: string;
    tipe: string;
    metode: string | null;
    bank: string | null;
    nominal: number;
    catatan: string | null;
    nomor_invoice: string | null;
    nama_pesanan: string | null;
}

/*
 * Arus Kas — riwayat payments (pemasukan). Tanpa DDL.
 * Filter ?q= dicocokkan ke nomor invoice, nama pesanan, catatan, bank.
 */
export default async function HalamanArusKas({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "keuangan.bayar")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Arus Kas.</p>
            </div>
        );
    }

    const sp = await searchParams;
    const v = sp.q;
    const q = (Array.isArray(v) ? v[0] : v ?? "").trim();
    const ambil = (nilai: string | string[] | undefined): string => (Array.isArray(nilai) ? nilai[0] : nilai ?? "").trim();
    const bulanIni = sekarangJakarta().slice(0, 7);
    const dari = ambil(sp.dari) || `${bulanIni}-01`;
    const sampai = ambil(sp.sampai) || sekarangJakarta();
    const pola = `%${q}%`;
    const filter = `(? = '' OR i.nomor_invoice LIKE ? OR o.nama_pesanan LIKE ? OR p.catatan LIKE ? OR p.bank LIKE ?) AND p.tanggal_bayar BETWEEN ? AND ?`;
    const params = [q, pola, pola, pola, pola, dari, sampai];

    const ringkas = await queryOne<{ c: number; s: string }>(
        `SELECT COUNT(*) c, COALESCE(SUM(p.nominal),0) s
         FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN orders o ON o.id = i.order_id
         WHERE ${filter}`,
        params,
    );

    const baris = await query<BarisArusKas>(
        `SELECT p.tanggal_bayar, p.tipe, p.metode, p.bank, p.nominal, p.catatan, i.nomor_invoice, o.nama_pesanan
         FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN orders o ON o.id = i.order_id
         WHERE ${filter}
         ORDER BY p.tanggal_bayar DESC, p.id DESC
         LIMIT 100`,
        params,
    );

    return (
        <>
            <div className="card-box">
                <div className="card-title">Ringkasan Pembayaran Masuk</div>
                <p className="mb-0">
                    <b>{ringkas?.c ?? 0}</b> transaksi &middot; total <b>{rupiah(ringkas?.s ?? 0)}</b>
                </p>
            </div>
            <div className="card-box">
                <div className="card-title">Arus Kas — Riwayat Pembayaran</div>
                <form method="get" action="/keuangan/arus-kas" className="row g-2 mb-3">
                    <div className="col-md-4">
                        <input className="form-control" name="q" defaultValue={q} placeholder="Cari nomor invoice, customer, catatan, atau bank" aria-label="Cari nomor invoice, customer, catatan, atau bank" />
                    </div>
                    <div className="col-md-3">
                        <input type="date" className="form-control" name="dari" defaultValue={dari} aria-label="Dari tanggal" />
                    </div>
                    <div className="col-md-3">
                        <input type="date" className="form-control" name="sampai" defaultValue={sampai} aria-label="Sampai tanggal" />
                    </div>
                    <div className="col-md-2">
                        <button type="submit" className="btn btn-outline-secondary w-full">Cari</button>
                    </div>
                </form>
                <div className="table-wrap">
                    <table className="tabel kartu-hp">
                        <thead>
                            <tr>
                                <th scope="col">Tanggal</th>
                                <th scope="col">Invoice</th>
                                <th scope="col">Customer</th>
                                <th scope="col">Tipe</th>
                                <th scope="col">Metode / Bank</th>
                                <th scope="col" className="num">Nominal</th>
                                <th scope="col">Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {baris.length === 0 && (
                                <tr>
                                    <td colSpan={7} data-label="">
                                        <div className="table-kosong">Tidak ada pembayaran yang cocok.</div>
                                    </td>
                                </tr>
                            )}
                            {baris.map((b, i) => (
                                <tr key={i}>
                                    <td data-label="Tanggal">{tglId(b.tanggal_bayar)}</td>
                                    <td data-label="Invoice" className="mono">{b.nomor_invoice || "-"}</td>
                                    <td data-label="Customer">{b.nama_pesanan || "-"}</td>
                                    <td data-label="Tipe" className="whitespace-nowrap">{b.tipe}</td>
                                    <td data-label="Metode / Bank">{[b.metode, b.bank].filter(Boolean).join(" / ") || "-"}</td>
                                    <td data-label="Nominal" className="num">{rupiah(b.nominal, false)}</td>
                                    <td data-label="Catatan">{b.catatan || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

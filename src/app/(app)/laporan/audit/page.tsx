import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { query } from "@/lib/db";

/** Satu baris log status global (status_logs + nomor order). */
interface BarisAudit {
    id: number;
    order_id: number;
    nomor_order: string | null;
    status_lama: string | null;
    status_baru: string;
    catatan: string | null;
    oleh: string | null;
    created_at: string;
}

/*
 * Audit Log global — HANYA MEMBACA status_logs. Tanpa DDL.
 * Filter ?q= dicocokkan ke oleh, catatan, status_baru, nomor_order.
 */
export default async function HalamanAuditLog({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "audit.lihat")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Audit Log.</p>
            </div>
        );
    }

    const sp = await searchParams;
    const v = sp.q;
    const q = (Array.isArray(v) ? v[0] : v ?? "").trim();
    const pola = `%${q}%`;

    const baris = await query<BarisAudit>(
        `SELECT s.id, s.order_id, o.nomor_order, s.status_lama, s.status_baru, s.catatan, s.oleh, s.created_at
         FROM status_logs s LEFT JOIN orders o ON o.id = s.order_id
         WHERE (? = '' OR s.oleh LIKE ? OR s.catatan LIKE ? OR s.status_baru LIKE ? OR o.nomor_order LIKE ?)
         ORDER BY s.id DESC
         LIMIT 100`,
        [q, pola, pola, pola, pola],
    );

    return (
        <>
            <div className="card-box">
                <div className="card-title">Audit Log Status</div>
                <form method="get" action="/laporan/audit" className="row g-2 mb-3">
                    <div className="col-md-10">
                        <input className="form-control" name="q" defaultValue={q} placeholder="Cari oleh, catatan, status, atau nomor order" />
                    </div>
                    <div className="col-md-2">
                        <button type="submit" className="btn btn-outline-secondary w-full">Cari</button>
                    </div>
                </form>
                <div className="table-wrap">
                    <table className="tabel kartu-hp">
                        <thead>
                            <tr>
                                <th scope="col">Waktu</th>
                                <th scope="col">Order</th>
                                <th scope="col">Perubahan</th>
                                <th scope="col">Catatan</th>
                                <th scope="col">Oleh</th>
                            </tr>
                        </thead>
                        <tbody>
                            {baris.length === 0 && (
                                <tr>
                                    <td colSpan={5} data-label="">
                                        <div className="table-kosong">Tidak ada log yang cocok.</div>
                                    </td>
                                </tr>
                            )}
                            {baris.map((b) => (
                                <tr key={b.id}>
                                    <td data-label="Waktu">{String(b.created_at).slice(0, 16)}</td>
                                    <td data-label="Order">
                                        {b.order_id ? <a href={`/pesanan/${b.order_id}`} className="mono">{b.nomor_order ?? `#${b.order_id}`}</a> : "-"}
                                    </td>
                                    <td data-label="Perubahan">{b.status_lama ? `${b.status_lama} → ` : ""}<b>{b.status_baru}</b></td>
                                    <td data-label="Catatan">{b.catatan || "-"}</td>
                                    <td data-label="Oleh" className="whitespace-nowrap">{b.oleh || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

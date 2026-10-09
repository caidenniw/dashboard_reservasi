import "server-only";
import { query, queryOne } from "@/lib/db";
import { paginasi, statusLabel, labelWilayah, type Paginasi } from "@/lib/format";

/*
 * Daftar pesanan — PORT PERSIS dari PesananController + includes/partial_pesanan_tabel.php.
 * Rangkaian WHERE, urutan (whitelist), dan SELECT-nya dijaga sama.
 */

export const PER_HALAMAN = 15;

export interface FilterPesanan {
    cari: string;
    status: string;
    bulan: string;
    dari: string;
    sampai: string;
    tipe: string;
    urut: string;
    hal: number;
}

/** Baca filter dari query string; nama & nilai bawaan sama seperti sistem lama. */
export function filterDari(sp: Record<string, string | string[] | undefined>): FilterPesanan {
    const s = (k: string, d = "") => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v ?? d).trim();
    };
    return {
        cari: s("cari"),
        status: s("status"),
        bulan: s("bulan"),
        dari: s("dari"),
        sampai: s("sampai"),
        tipe: s("tipe"),
        urut: s("urut", "desc") || "desc",
        hal: Math.max(1, Number(s("hal", "1")) || 1),
    };
}

/** Rangkaian WHERE + binding, disusun apa adanya seperti pesanan_list.php. */
export function whereSql(f: FilterPesanan): [string, unknown[]] {
    const where: string[] = ["o.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (f.cari !== "") {
        where.push(`(o.nomor_order LIKE ? OR o.nama_pesanan LIKE ? OR o.nama_pic LIKE ? OR o.kota LIKE ?
                     OR EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.nopol LIKE ?)
                     OR EXISTS (SELECT 1 FROM invoices v WHERE v.order_id = o.id AND v.nomor_invoice LIKE ? AND v.status <> 'batal'))`);
        for (let i = 0; i < 6; i++) {
            params.push(`%${f.cari}%`);
        }
    }
    if (f.status !== "") {
        where.push("o.status = ?");
        params.push(f.status);
    }
    if (f.bulan !== "") {
        where.push("DATE_FORMAT(o.tgl_mulai, '%Y-%m') = ?");
        params.push(f.bulan);
    }
    if (f.dari !== "") {
        where.push("o.tgl_mulai >= ?");
        params.push(f.dari);
    }
    if (f.sampai !== "") {
        where.push("o.tgl_mulai <= ?");
        params.push(f.sampai);
    }
    if (["retail", "corporate", "RO", "RTR"].includes(f.tipe)) {
        where.push("o.tipe_pelanggan = ?");
        params.push(f.tipe);
    }

    return ["WHERE " + where.join(" AND "), params];
}

/** Urutan tampil: whitelist, di luar itu fallback ke default (sewa terbaru). */
export function orderSql(urut: string): string {
    if (urut === "input") {
        return "o.created_at DESC, o.id DESC";
    }
    if (urut === "nomor") {
        return "o.nomor_order DESC, o.id DESC";
    }
    /* "asc" = tanggal sewa terlama lebih dulu (opsi "Terlama" di form daftar). */
    if (urut === "asc") {
        return "o.tgl_mulai ASC, o.id ASC";
    }
    return "o.tgl_mulai DESC, o.id DESC";
}

/** SELECT utama (tanpa LIMIT/OFFSET) — dipakai daftar maupun export CSV. */
export function sqlData(whereSqlStr: string, orderSqlStr: string): string {
    return `SELECT o.*,
            (SELECT GROUP_CONCAT(DISTINCT i.nama_unit SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) AS unit_list,
            (SELECT GROUP_CONCAT(DISTINCT i.nopol SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) AS nopol_list,
            inv.nomor_invoice, inv.status AS inv_status, inv.sisa AS inv_sisa
        FROM orders o
        LEFT JOIN invoices inv ON inv.id = (SELECT id FROM invoices WHERE order_id = o.id AND status <> 'batal' ORDER BY id DESC LIMIT 1)
        ${whereSqlStr}
        ORDER BY ${orderSqlStr}`;
}

export interface BarisPesanan extends Record<string, unknown> {
    id: number;
    nomor_order: string;
    tgl_mulai: string;
    jumlah_hari: number;
    nama_pesanan: string;
    kota: string;
    nama_pic: string | null;
    unit_list: string | null;
    nopol_list: string | null;
    status: string;
    nomor_invoice: string | null;
    inv_status: string | null;
    inv_sisa: number | null;
    grand_total: number;
}

export interface HasilDaftar {
    rows: BarisPesanan[];
    pg: Paginasi;
    total: number;
    bulanList: string[];
}

export async function daftarPesanan(f: FilterPesanan): Promise<HasilDaftar> {
    const [where, params] = whereSql(f);
    const order = orderSql(f.urut);

    const total = Number((await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM orders o ${where}`, params))?.c ?? 0);
    const pg = paginasi(total, PER_HALAMAN, f.hal);

    const rows = await query<BarisPesanan>(
        sqlData(where, order) + ` LIMIT ${PER_HALAMAN} OFFSET ${Number(pg.offset)}`,
        params,
    );

    const bulanRows = await query<{ b: string }>(
        "SELECT DISTINCT DATE_FORMAT(tgl_mulai, '%Y-%m') b FROM orders WHERE deleted_at IS NULL ORDER BY b DESC",
    );

    return { rows, pg, total, bulanList: bulanRows.map((r) => r.b) };
}

/* ------------------------------- EXPORT CSV ------------------------------- */

/** Baris CSV lengkap (tanpa LIMIT), termasuk kolom modal bila peran boleh melihatnya. */
export async function barisExportCsv(f: FilterPesanan, bolehModal: boolean): Promise<string[][]> {
    const [where, params] = whereSql(f);
    const order = orderSql(f.urut);
    const all = await query<BarisPesanan>(sqlData(where, order), params);

    const kepala = [
        "Nomor Order", "Tanggal Mulai", "Tanggal Selesai", "Hari", "Pesanan", "PIC", "HP PIC", "Kota",
        "Wilayah", "Unit", "Nopol", "Driver", "Status", "Total Jual",
    ];
    if (bolehModal) {
        kepala.push("Total Modal");
    }
    if (bolehModal) {
        kepala.push("Margin");
    }
    kepala.push("Nomor Invoice", "Status Invoice", "Sisa");

    const hasil: string[][] = [kepala];

    for (const row of all) {
        const drv =
            (await queryOne<{ d: string }>(
                'SELECT GROUP_CONCAT(nama_driver SEPARATOR ", ") d FROM order_items WHERE order_id = ?',
                [row.id],
            ))?.d ?? "";

        const isi: string[] = [
            str(row.nomor_order), str(row.tgl_mulai), str(row.tgl_finish), str(row.jumlah_hari), str(row.nama_pesanan),
            str(row.nama_pic), str(row.hp_pic), str(row.kota), labelWilayah(str(row.wilayah_pelayanan)),
            str(row.unit_list), str(row.nopol_list), str(drv), statusLabel(str(row.status)),
            str(row.total_jual),
        ];
        if (bolehModal) {
            isi.push(str(row.total_modal));
            isi.push(str(row.margin));
        }
        isi.push(str(row.nomor_invoice), row.inv_status ? statusLabel(str(row.inv_status)) : "", str(row.inv_sisa));
        hasil.push(isi);
    }

    return hasil;
}

function str(v: unknown): string {
    return v === null || v === undefined ? "" : String(v);
}

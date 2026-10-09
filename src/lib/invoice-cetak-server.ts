import "server-only";
import { query, queryOne } from "@/lib/db";
import { ambilOrder, daftarBank, type OrderLengkap } from "@/lib/app-lib";
import { semuaSetting } from "@/lib/settings";
import { APP_PT } from "@/lib/brand";

/*
 * Data halaman cetak invoice — port PERSIS app/Http/Controllers/InvoiceController::cetak.
 * HANYA MEMBACA data (tidak ada INSERT/UPDATE).
 *
 * Catatan penting soal pesan penolakan: controller Laravel memakai
 * redirect()->route('pesanan.detail', $id) padahal `$id` di situ adalah ID INVOICE,
 * bukan ID pesanan. Redirect itu menyesatkan (dan tidak mungkin dipakai dari Server
 * Component karena flash butuh cookie tulis), jadi halaman Next menampilkan kartu
 * "Akses ditolak" dengan TEKS PESAN YANG SAMA, tanpa redirect.
 */

/** Satu baris `invoice_items` yang dicetak. */
export interface BarisItemInvoice {
    id: number;
    no: number;
    keterangan: string | null;
    driver: string | null;
    tanggal_pakai: string | null;
    rute: string | null;
    harga_hari: number | string;
    total_hari: number | string;
    total_harga: number | string;
}

/** Baris `invoices` yang dipakai cetak. */
export interface BarisInvoice {
    id: number;
    order_id: number;
    nomor_invoice: string;
    tanggal_invoice: string | null;
    jatuh_tempo: string | null;
    total: number | string;
    status: string | null;
    customer_snapshot: string | null;
}

export interface SnapshotCustomer {
    nama?: string;
    pic?: string;
}

export interface Bank {
    nama: string;
    rekening: string;
    atas_nama: string;
}

export interface DataCetak {
    inv: BarisInvoice;
    order: OrderLengkap;
    items: BarisItemInvoice[];
    dpSum: number;
    sisa: number;
    custSnap: SnapshotCustomer;
    batal: boolean;
    namaPT: string;
    totalInv: number;
    bankList: Bank[];
    template: string;
    /** Semua baris tabel `settings` — view membacanya dengan cadangan seperti getSetting(). */
    setelan: Record<string, string>;
}

/** Hasil cetak; `langsung` = respons teks biasa seperti `response('…')` di Laravel. */
export type HasilCetak =
    | { jenis: "data"; data: DataCetak }
    | { jenis: "teks"; pesan: string };

/** Escape HTML seperti `e()` Laravel (htmlspecialchars ENT_QUOTES). */
export function escapeHtml(nilai: unknown): string {
    return String(nilai ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** `nl2br(e($nilai))` — escape dulu, baru baris baru jadi <br />. */
export function nl2br(nilai: unknown): string {
    return escapeHtml(nilai).replace(/\r\n|\r|\n/g, "<br />");
}

/** Ambil data cetak sebuah invoice; lihat `HasilCetak` untuk kasus tidak ditemukan. */
export async function ambilInvoiceCetak(id: number): Promise<HasilCetak> {
    const inv = await queryOne<BarisInvoice>(
        `SELECT id, order_id, nomor_invoice, tanggal_invoice, jatuh_tempo, total, status, customer_snapshot
         FROM invoices WHERE id = ? LIMIT 1`,
        [id],
    );
    if (!inv) {
        return { jenis: "teks", pesan: "Invoice tidak ditemukan." };
    }
    inv.id = Number(inv.id);
    inv.order_id = Number(inv.order_id);

    const order = await ambilOrder(inv.order_id);
    if (!order) {
        return { jenis: "teks", pesan: "Pesanan untuk invoice ini tidak ditemukan." };
    }

    const items = await query<BarisItemInvoice>(
        `SELECT id, no, keterangan, driver, tanggal_pakai, rute, harga_hari, total_hari, total_harga
         FROM invoice_items WHERE invoice_id = ? ORDER BY no, id`,
        [id],
    );

    const p = await queryOne<{ dp: string; total: string }>(
        `SELECT COALESCE(SUM(CASE WHEN tipe = "dp" THEN nominal ELSE 0 END),0) dp,
                COALESCE(SUM(nominal),0) total
         FROM payments WHERE invoice_id = ?`,
        [id],
    );
    const dpSum = Number(p?.dp ?? 0);
    const dibayar = Number(p?.total ?? 0);
    const totalInv = Number(inv.total ?? 0);
    const sisa = Math.max(0, totalInv - dibayar);

    const custSnap = (JSON.parse(String(inv.customer_snapshot ?? "") || "{}") as SnapshotCustomer) ?? {};
    const batal = (inv.status ?? "") === "batal";

    const setelan = await semuaSetting();
    const namaPT = setelan["nama_pt"] || APP_PT;

    /* Revisi #3: template invoice per pesanan (klasik/modern).
       Revisi #5: opsi bank yang dicetak (kosong = semua bank). */
    const template = String(order.template_invoice ?? "klasik");
    const bankPilih = String(order.bank_invoice ?? "").trim();
    let bankList = await daftarBank();
    if (bankPilih !== "") {
        bankList = bankList.filter((b) => b.nama.toLowerCase() === bankPilih.toLowerCase());
    }

    return {
        jenis: "data",
        data: {
            inv,
            order,
            items,
            dpSum,
            sisa,
            custSnap,
            batal,
            namaPT,
            totalInv,
            bankList,
            template,
            setelan,
        },
    };
}

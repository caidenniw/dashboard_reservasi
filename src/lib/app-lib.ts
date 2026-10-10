import "server-only";
import { query, queryOne, transaction } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { rupiah, labelWilayah, sekarangJakarta, normalisasiHp } from "@/lib/format";
import { APP_PT_KAPITAL } from "@/lib/brand";

/*
 * Helper domain — port dari app/Support/app_lib.php.
 * Penomoran dokumen, hitung order, cek bentrok unit, teks WhatsApp, dan teks bantu.
 */

/* ============================== LABEL & TEKS ============================== */

const BULAN_ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function bulanRomawi(bulan: number): string {
    return BULAN_ROMAWI[bulan] ?? "";
}

/** Angka menjadi huruf Indonesia (dipakai di cetak invoice). */
export function terbilang(n: number): string {
    n = Math.trunc(n);
    if (n < 0) {
        return "Minus " + terbilang(-n);
    }
    const angka = [
        "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan",
        "Sepuluh", "Sebelas",
    ];
    if (n < 12) {
        return angka[n];
    }
    if (n < 20) {
        return terbilang(n - 10) + " Belas";
    }
    if (n < 100) {
        return terbilang(Math.trunc(n / 10)) + " Puluh" + (n % 10 ? " " + terbilang(n % 10) : "");
    }
    if (n < 200) {
        return "Seratus" + (n - 100 ? " " + terbilang(n - 100) : "");
    }
    if (n < 1000) {
        return terbilang(Math.trunc(n / 100)) + " Ratus" + (n % 100 ? " " + terbilang(n % 100) : "");
    }
    if (n < 2000) {
        return "Seribu" + (n - 1000 ? " " + terbilang(n - 1000) : "");
    }
    if (n < 1_000_000) {
        return terbilang(Math.trunc(n / 1000)) + " Ribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
    }
    if (n < 1_000_000_000) {
        return terbilang(Math.trunc(n / 1_000_000)) + " Juta" + (n % 1_000_000 ? " " + terbilang(n % 1_000_000) : "");
    }
    if (n < 1_000_000_000_000) {
        return terbilang(Math.trunc(n / 1_000_000_000)) + " Miliar" + (n % 1_000_000_000 ? " " + terbilang(n % 1_000_000_000) : "");
    }
    return terbilang(Math.trunc(n / 1_000_000_000_000)) + " Triliun" + (n % 1_000_000_000_000 ? " " + terbilang(n % 1_000_000_000_000) : "");
}

const NAMA_BULAN_SINGKAT = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "27-30 Sep 26" atau "30 Sep - 02 Okt 26" (port formatRentang). Tanggal BER-NOL (date('d')). */
export function formatRentang(mulai: string, finish: string): string {
    const a = tanggalKomponen(mulai);
    const b = tanggalKomponen(finish);
    if (!a || !b) {
        return "-";
    }
    const pa = String(a.d).padStart(2, "0");
    const pb = String(b.d).padStart(2, "0");
    if (a.m === b.m && a.y === b.y) {
        return `${pa}-${pb} ${NAMA_BULAN_SINGKAT[a.m]} ${String(a.y).slice(2)}`;
    }
    return `${pa} ${NAMA_BULAN_SINGKAT[a.m]} - ${pb} ${NAMA_BULAN_SINGKAT[b.m]} ${String(b.y).slice(2)}`;
}

/** Pemetaan kolom "Asal User" dari Excel lama -> tipe_pelanggan + sumber. */
export function mapAsalUser(raw: string): { tipe: string; sumber: string; raw: string } {
    let k = String(raw ?? "").trim().toLowerCase();
    k = k.replace(/\s+/g, "");
    if (["corp", "co", "corporate", "corporation"].includes(k)) return { tipe: "corporate", sumber: "wa", raw };
    if (k === "apkasi") return { tipe: "corporate", sumber: "wa", raw };
    if (k === "ro") return { tipe: "RO", sumber: "wa", raw };
    if (["rtr", "renttorent", "rent-to-rent"].includes(k)) return { tipe: "RTR", sumber: "wa", raw };
    if (k === "ig") return { tipe: "retail", sumber: "instagram", raw };
    if (k === "tiktok") return { tipe: "retail", sumber: "tiktok", raw };
    if (["web", "website"].includes(k)) return { tipe: "retail", sumber: "website", raw };
    if (k === "office") return { tipe: "retail", sumber: "lainnya", raw };
    if (k === "butika") return { tipe: "retail", sumber: "referral", raw };
    if (k === "") return { tipe: "retail", sumber: "wa", raw: "" };
    return { tipe: "retail", sumber: "lainnya", raw };
}






export function daftarUpgrade(): string[] {
    return ["Up Reborn", "Reborn", "Up Avanza", "Avanza", "Zenix G", "Premio Std", "Up Zenix", "Up Hiace"];
}

function tanggalKomponen(tgl: string | null | undefined): { y: number; m: number; d: number } | null {
    const m = String(tgl ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/* ============================== PENOMORAN DOKUMEN ============================== */

/**
 * Nomor order (RN-YYMM-0001 / Yus-2610-0012) dan nomor faktur
 * (1000-INV/IX/MDN-24621, urut GLOBAL lanjut dari 24620).
 * Dikunci SELECT ... FOR UPDATE supaya tidak ada nomor kembar.
 *
 * @param panggilan nama pendek pembuat (dari users.panggilan) untuk prefix order
 */
export async function nomorDokumen(jenis: "order" | "invoice", panggilan = ""): Promise<string> {
    const now = sekarangJakarta(); // "YYYY-MM-DD" (Asia/Jakarta)
    const tahunBulan = now.slice(0, 7);
    const bulan = Number(now.slice(5, 7));

    if (jenis === "invoice") {
        const prefix = await getSetting("prefix_invoice", "1000-INV");
        const cabang = ((await getSetting("kode_cabang", "MDN")).trim().toUpperCase()) || "MDN";
        const periode = "global";

        const urut = await naikkanCounter(jenis, periode, 24621);
        return `${prefix}/${bulanRomawi(bulan)}/${cabang}-${urut}`;
    }

    /* order: nomor per bulan memakai NAMA PENANGGUNG JAWAB, mis. Yus-2610-0012.
       Kalau pemakai belum punya panggilan, pakai awalan lama dari Pengaturan. */
    const prefix = panggilan || (await getSetting("prefix_order", "RN"));
    const periode = tahunBulan;
    const urut = await naikkanCounter(jenis, periode, 1);
    return `${prefix}-${tahunBulan.replace("-", "").slice(2)}-${String(urut).padStart(4, "0")}`;
}

/** Naikkan counter dokumen dalam transaksi terkunci. */
async function naikkanCounter(jenis: string, periode: string, mulaiDari: number): Promise<number> {
    return transaction(async (conn) => {
        const [rows] = await conn.query(
            "SELECT `urut` FROM doc_counters WHERE `jenis` = ? AND `periode` = ? FOR UPDATE",
            [jenis, periode],
        );
        const row = (rows as Array<{ urut: number }>)[0];
        const baru = row ? Number(row.urut) + 1 : mulaiDari;
        if (row) {
            await conn.query(
                "UPDATE doc_counters SET `urut` = ? WHERE `jenis` = ? AND `periode` = ?",
                [baru, jenis, periode],
            );
        } else {
            await conn.query(
                "INSERT INTO doc_counters (`jenis`, `periode`, `urut`) VALUES (?, ?, ?)",
                [jenis, periode, baru],
            );
        }
        return baru;
    });
}

/* ============================== ORDER ============================== */

export interface TotalOrder {
    total_modal: number;
    total_jual: number;
    total_tambahan: number;
    grand_total: number;
    margin: number;
}

/** Hitung ulang total order dari item + biaya tambahan, simpan, lalu kembalikan nilainya. */
export async function hitungOrder(orderId: number): Promise<TotalOrder> {
    const it = await queryOne<{ m: number; j: number }>(
        "SELECT COALESCE(SUM(subtotal_modal),0) m, COALESCE(SUM(subtotal_jual),0) j FROM order_items WHERE order_id = ?",
        [orderId],
    );
    const total_modal = Number(it?.m ?? 0);
    const total_jual = Number(it?.j ?? 0);

    const biayaRow = await queryOne<{ n: number }>(
        "SELECT COALESCE(SUM(nominal),0) n FROM order_biaya WHERE order_id = ?",
        [orderId],
    );
    const incRow = await queryOne<{ n: number }>(
        "SELECT COALESCE(SUM(biaya),0) n FROM order_includes WHERE order_id = ?",
        [orderId],
    );
    const biaya = Number(biayaRow?.n ?? 0);
    const incBiaya = Number(incRow?.n ?? 0);

    const total_tambahan = biaya + incBiaya;
    const grand_total = total_jual + total_tambahan;
    const margin = grand_total - total_modal;

    await query(
        "UPDATE orders SET total_modal = ?, total_jual = ?, total_tambahan = ?, grand_total = ?, margin = ? WHERE id = ?",
        [total_modal, total_jual, total_tambahan, grand_total, margin, orderId],
    );

    return { total_modal, total_jual, total_tambahan, grand_total, margin };
}

export interface OrderItem {
    id: number;
    order_id: number;
    unit_id: number | null;
    driver_id: number | null;
    partner_id: number | null;
    nama_unit: string;
    nopol: string;
    upgrade: string | null;
    nama_driver: string | null;
    hp_driver: string | null;
    harga_modal_per_hari: number;
    harga_jual_per_hari: number;
    jumlah_hari: number;
    subtotal_modal: number;
    subtotal_jual: number;
    catatan: string | null;
    partner_nama?: string | null;
}

export interface OrderLengkap extends Record<string, unknown> {
    id: number;
    items: OrderItem[];
    includes: Array<Record<string, unknown>>;
    biaya: Array<Record<string, unknown>>;
    invoices: Array<Record<string, unknown>>;
    logs: Array<Record<string, unknown>>;
}

/** Ambil order lengkap (order + customer + items + include + biaya + invoice + log status). */
export async function ambilOrder(id: number): Promise<OrderLengkap | null> {
    const o = await queryOne<Record<string, unknown>>(
        `SELECT o.*, c.tipe AS customer_tipe, c.alamat AS customer_alamat, c.email AS customer_email,
                c.status AS customer_status, p.nama AS partner_nama
         FROM orders AS o
         LEFT JOIN customers AS c ON c.id = o.customer_id
         LEFT JOIN partners AS p ON p.id = o.partner_id
         WHERE o.id = ? AND o.deleted_at IS NULL`,
        [id],
    );
    if (!o) {
        return null;
    }

    const items = await query<OrderItem>(
        `SELECT oi.*, p.nama AS partner_nama
         FROM order_items AS oi
         LEFT JOIN partners AS p ON p.id = oi.partner_id
         WHERE oi.order_id = ? ORDER BY oi.id`,
        [id],
    );
    const includes = await query<Record<string, unknown>>(
        "SELECT * FROM order_includes WHERE order_id = ? ORDER BY id",
        [id],
    );
    const biaya = await query<Record<string, unknown>>(
        "SELECT * FROM order_biaya WHERE order_id = ? ORDER BY id",
        [id],
    );
    const invoices = await query<Record<string, unknown>>(
        "SELECT * FROM invoices WHERE order_id = ? AND status <> 'batal' ORDER BY id DESC",
        [id],
    );
    const logs = await query<Record<string, unknown>>(
        "SELECT * FROM status_logs WHERE order_id = ? ORDER BY id DESC LIMIT 30",
        [id],
    );

    return { ...(o as OrderLengkap), id: Number(o.id), items, includes, biaya, invoices, logs };
}

/** Catat perubahan status ke status_logs. */
export async function catatStatus(
    orderId: number,
    lama: string | null,
    baru: string,
    catatan = "",
    oleh = "admin",
): Promise<void> {
    await query(
        "INSERT INTO status_logs (order_id, status_lama, status_baru, catatan, oleh) VALUES (?, ?, ?, ?, ?)",
        [orderId, lama, baru, catatan, oleh],
    );
}

export interface BentrokItem {
    id: number;
    nomor_order: string;
    tgl_mulai: string;
    tgl_finish: string;
    nama_pesanan: string;
}

/** Cek bentrok jadwal unit. Kembalikan daftar order yang bertumpuk. */
export async function cekBentrokUnit(
    unitId: number,
    mulai: string,
    finish: string,
    kecualiOrder = 0,
): Promise<BentrokItem[]> {
    return query<BentrokItem>(
        `SELECT o.id, o.nomor_order, o.tgl_mulai, o.tgl_finish, o.nama_pesanan
         FROM order_items AS i
         JOIN orders AS o ON o.id = i.order_id
         WHERE i.unit_id = ?
           AND o.id <> ?
           AND o.deleted_at IS NULL
           AND o.status NOT IN ('cancelled','closed','draft')
           AND NOT (o.tgl_finish < ? OR o.tgl_mulai > ?)
         ORDER BY o.tgl_mulai`,
        [unitId, kecualiOrder, mulai, finish],
    );
}

/** Daftar nama partner yang mendukung sebuah order. */
export function partnerList(order: { items?: OrderItem[] }): string {
    const names = new Set<string>();
    for (const it of order.items ?? []) {
        if (it.partner_nama) {
            names.add(it.partner_nama);
        }
    }
    return Array.from(names).join(", ");
}

/* ============================== TEKS WHATSAPP ============================== */

/** Susun teks konfirmasi pesanan untuk WhatsApp — port teksWaOrder(). */
export async function teksWaOrder(o: Record<string, unknown>, denganHarga = true): Promise<string> {
    const garis = "___________________________";
    const hari = Number(o.jumlah_hari ?? 0);
    const baris: string[] = [];
    const items = (o.items as OrderItem[]) ?? [];
    const includes = (o.includes as Array<{ nama: string }>) ?? [];
    const biaya = (o.biaya as Array<{ nama: string; nominal: number }>) ?? [];

    baris.push(await getSetting("nama_pt", APP_PT_KAPITAL));
    baris.push("");
    baris.push("Pelayanan: " + labelWilayah(String(o.wilayah_pelayanan)) + " " + String(o.kota ?? ""));
    baris.push("Tanggal: " + tglDmY(String(o.tgl_mulai)) + " s/d " + tglDmY(String(o.tgl_finish)) + ` (${hari} Day)`);
    baris.push(garis);

    items.forEach((it, i) => {
        if (i > 0) {
            baris.push("- - - - - - - - - - - - - -");
        }
        baris.push("Nama Driver : " + (it.nama_driver || "-"));
        baris.push("Hp/Wa : " + (it.hp_driver || "-"));
        baris.push("Unit : " + it.nama_unit);
        baris.push("No. Plat : " + it.nopol);
    });
    baris.push(garis);
    baris.push("Stanby: " + (o.standby_point ? String(o.standby_point) : "-"));
    baris.push("Flight: " + (o.flight ? String(o.flight) : "-"));
    baris.push(
        "Jam: " +
            (Number(o.jam_koordinasi ?? 0)
                ? "Kordinasi dengan user"
                : o.jam
                    ? String(o.jam)
                    : "-"),
    );
    baris.push("");
    baris.push("Pesanan : " + String(o.nama_pesanan ?? ""));
    baris.push("Pic : " + (o.nama_pic ? String(o.nama_pic) : "-"));
    baris.push("Hp/Wa : " + (o.hp_pic ? String(o.hp_pic) : "-"));
    baris.push("");
    baris.push("Include : " + (includes.length ? includes.map((x) => x.nama).join("+") : "-"));

    if (denganHarga) {
        baris.push("");
        for (const it of items) {
            baris.push("Harga " + it.nama_unit + " : " + rupiah(it.harga_jual_per_hari) + "/hari");
        }
        for (const b of biaya) {
            baris.push(b.nama + " : " + rupiah(b.nominal));
        }
        baris.push("Total : " + rupiah(Number(o.grand_total ?? 0)) + ` (${hari} hari)`);
    }

    baris.push("");
    baris.push(await getSetting("footer_invoice", "Terimakasih atas Pilihan Perjalanan Anda Bersama Kami."));
    baris.push("");
    baris.push(await getSetting("tagline", ""));
    baris.push("");
    baris.push("Instagram/TikTok : " + (await getSetting("instagram_pt", "")));
    baris.push("Website : " + (await getSetting("website_pt", "")));
    baris.push("Email : " + (await getSetting("email_pt", "")));

    return baris.join("\n");
}

function tglDmY(tgl: string): string {
    const m = String(tgl ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "-";
}

/* ============================== UPLOAD ============================== */

/** Normalisasi nomor HP (re-export agar pemanggil domain tidak perlu impor ganda). */
export { normalisasiHp };

/**
 * Daftar bank untuk pilihan cetak invoice.
 * Sumber: Pengaturan Faktur -> daftar_bank, satu bank per baris:
 *   Nama Bank | No. Rekening | Atas Nama
 */
export async function daftarBank(): Promise<Array<{ nama: string; rekening: string; atas_nama: string }>> {
    const isi = await getSetting("daftar_bank");
    const out: Array<{ nama: string; rekening: string; atas_nama: string }> = [];
    for (const barisRaw of isi.split(/\r\n|\r|\n/)) {
        const baris = barisRaw.trim();
        if (baris === "") {
            continue;
        }
        const bagian = baris.split("|").map((x) => x.trim());
        if (bagian[0] === "") {
            continue;
        }
        out.push({
            nama: bagian[0],
            rekening: bagian[1] ?? "",
            atas_nama: bagian[2] ?? "",
        });
    }
    return out;
}

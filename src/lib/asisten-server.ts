import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { bolehLihatModal } from "@/lib/akses";
import type { Role } from "@/lib/akses";
import { bulanPanjang, sekarangJakarta, statusLabel, tglAngka } from "@/lib/format";

/*
 * Mesin Asisten Data — port PERSIS legacy-laravel/app/Support/Asisten.php
 * (yang menyalin includes/asisten_lib.php) + AsistenParse.php.
 *
 * ATURAN RANCANGAN yang dipertahankan:
 * - TIDAK ADA satu pun query yang mengubah data (SELECT saja).
 * - Asisten hanya menjawab dari konteks yang dikirim; kalau data tidak ada,
 *   model diinstruksikan menjawab jujur.
 *
 * Perbedaan dari Laravel (keduanya disengaja, lihat alasan di tempatnya):
 * - Kredensial dari env (ASISTEN_API_KEY dkk), bukan config/asisten.local.php.
 * - Token keamanan = HMAC-SHA256(APP_KEY, "asisten:<userId>"), bukan sesi file.
 * - Pembatas laju memakai Map memori (lihat bolehJalan).
 */

/* ============================== KONFIGURASI ============================== */

export interface KonfigAsisten {
    apiKey: string;
    model: string;
    modelCadangan: string[];
    baseUrl: string;
}

/** Kredensial asisten dari environment. */
export function konfig(): KonfigAsisten {
    return {
        apiKey: process.env.ASISTEN_API_KEY ?? "",
        model: process.env.ASISTEN_MODEL || "gemini-flash-lite-latest",
        modelCadangan: (process.env.ASISTEN_MODEL_CADANGAN ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s !== ""),
        baseUrl: (process.env.ASISTEN_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, ""),
    };
}

/** Apakah kunci API terisi (asisten bisa menjawab)? */
export function siap(): boolean {
    return konfig().apiKey !== "";
}

function kunciHmac(): Buffer {
    const s = process.env.APP_KEY ?? process.env.SESSION_SECRET ?? "";
    return Buffer.from(s === "" ? "kunci-hmac-belum-disetel" : s);
}

/**
 * Token endpoint asisten/parse untuk satu user. Berbeda dengan token CSRF form,
 * token ini stabil per user (tanpa sesi file) supaya widget & tombol Bedah boleh
 * mengirim berkali-kali tanpa memuat ulang halaman. Aman karena endpoint parse
 * tidak menyimpan apa pun dan endpoint asisten hanya membaca data.
 */
export function tokenUntuk(userId: number): string {
    return createHmac("sha256", kunciHmac()).update(`asisten:${userId}`).digest("hex");
}

/** Verifikasi token milik user itu (perbandingan waktu-konstan). */
export function cekToken(userId: number, token: string): boolean {
    const harap = tokenUntuk(userId);
    const a = Buffer.from(token);
    const b = Buffer.from(harap);
    return a.length === b.length && timingSafeEqual(a, b);
}

/* ============================== PEMBATAS LAJU ============================== */

/* ponytail: pembatas ini disimpan di Map memori per proses (tabel khusus di DB
   butuh DDL, dan DDL dilarang di database ini). Naik kelas bila aplikasi jalan
   di >1 proses: pindah ke tabel `rate_limit` + INSERT ... ON DUPLICATE KEY. */
const ember = new Map<string, number[]>();

/** true bila permintaan ini lolos (maks dalam jendelaDetik terakhir). */
export function bolehJalan(kunci: string, maks: number, jendelaDetik: number): boolean {
    const kini = Date.now() / 1000;
    const segar = (ember.get(kunci) ?? []).filter((t) => kini - t < jendelaDetik);
    if (segar.length >= maks) {
        ember.set(kunci, segar);
        return false;
    }
    segar.push(kini);
    ember.set(kunci, segar);
    return true;
}

/* ==================== PENGUMPULAN DATA (BACA SAJA) ==================== */

interface BarisPesanan {
    nomor_order: string;
    nama_pesanan: string | null;
    kota: string | null;
    tgl_mulai: string;
    tgl_finish: string;
    jumlah_hari: number;
    status: string;
    grand_total: number | string;
    nama_pic: string | null;
    hp_pic: string | null;
    standby_point?: string | null;
    nopol: string | null;
    driver: string | null;
}

interface BarisInvoice {
    nomor_invoice: string;
    tanggal_invoice: string | null;
    jatuh_tempo: string | null;
    total: number | string;
    dp: number | string;
    sisa: number | string;
    status: string;
    nomor_order: string;
    nama_pesanan: string | null;
    nama_pic: string | null;
    hp_pic: string | null;
}

function uang(n: unknown): string {
    return Number(n ?? 0).toLocaleString("id-ID");
}

/** RINGKASAN SISTEM — port Asisten::ringkasan. */
export async function ringkasan(): Promise<string> {
    const hariIni = sekarangJakarta();
    const bulanAwal = `${hariIni.slice(0, 7)}-01`;
    const y = Number(hariIni.slice(0, 4));
    const m = Number(hariIni.slice(5, 7));
    const bulanAkhir = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

    const hitung = async (sql: string, params: unknown[] = []): Promise<number> =>
        Number((await queryOne<{ c: number | string }>(sql, params))?.c ?? 0);

    const berjalan = await hitung(
        `SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL AND status NOT IN ('cancelled','closed')
         AND tgl_mulai <= ? AND tgl_finish >= ?`,
        [hariIni, hariIni],
    );
    const bulanIni = await hitung(
        "SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL AND tgl_mulai BETWEEN ? AND ?",
        [bulanAwal, bulanAkhir],
    );
    const unitKeluar = await hitung(
        `SELECT COUNT(DISTINCT i.unit_id) c FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.deleted_at IS NULL AND i.unit_id IS NOT NULL AND o.status NOT IN ('cancelled','closed')
           AND o.tgl_mulai <= ? AND o.tgl_finish >= ?`,
        [hariIni, hariIni],
    );

    const papan: string[] = [];
    for (const r of await query<{ status: string; c: number }>(
        "SELECT status, COUNT(*) c FROM orders WHERE deleted_at IS NULL GROUP BY status ORDER BY c DESC",
    )) {
        papan.push(`${statusLabel(r.status)}=${Number(r.c)}`);
    }

    const inv = await queryOne<{ c: number; s: number | string }>(
        `SELECT COUNT(*) c, COALESCE(SUM(i.sisa),0) s FROM invoices i JOIN orders o ON o.id = i.order_id
         WHERE i.status IN ('terbit','sebagian') AND o.deleted_at IS NULL
           AND o.status NOT IN ('cancelled','closed')`,
    );

    const jualBulan = Number(
        (
            await queryOne<{ t: number | string }>(
                `SELECT COALESCE(SUM(grand_total),0) t FROM orders
                 WHERE deleted_at IS NULL AND status NOT IN ('cancelled','closed')
                   AND tgl_mulai BETWEEN ? AND ?`,
                [bulanAwal, bulanAkhir],
            )
        )?.t ?? 0,
    );

    const tot = await queryOne<{ o: number; u: number; d: number; c: number }>(
        `SELECT COUNT(*) o, (SELECT COUNT(*) FROM units WHERE deleted_at IS NULL) u,
                (SELECT COUNT(*) FROM drivers WHERE deleted_at IS NULL) d,
                (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) c
         FROM orders WHERE deleted_at IS NULL`,
    );

    const namaBulan = bulanPanjang(m);
    let out = `RINGKASAN SISTEM (tanggal hari ini ${hariIni.slice(8, 10)}-${hariIni.slice(5, 7)}-${hariIni.slice(0, 4)})\n`;
    out += `- Pesanan berjalan hari ini: ${berjalan}\n`;
    out += `- Unit keluar hari ini: ${unitKeluar}\n`;
    out += `- Pesanan bulan ini (${namaBulan} ${y}): ${bulanIni}, nilai Rp ${uang(jualBulan)}\n`;
    out += `- Invoice belum lunas: ${Number(inv?.c ?? 0)} (sisa total Rp ${uang(inv?.s ?? 0)})\n`;
    out += `- Jumlah data: ${Number(tot?.o ?? 0)} pesanan, ${Number(tot?.u ?? 0)} unit, ${Number(tot?.d ?? 0)} driver, ${Number(tot?.c ?? 0)} pelanggan\n`;
    out += `- Sebaran status pesanan: ${papan.join(", ")}\n`;
    out += "- Catatan: pesanan historis impor berstatus Lunas tanpa invoice tidak dihitung sebagai pendapatan.\n";
    return out;
}

function formatPesanan(judul: string, rows: BarisPesanan[]): string {
    if (rows.length === 0) {
        return `${judul}: tidak ada data yang cocok.\n`;
    }
    let out = `${judul} (${rows.length} baris)\n`;
    rows.forEach((r, i) => {
        out += `${i + 1}. ${r.nomor_order} | ${tglAngka(r.tgl_mulai)} s/d ${tglAngka(r.tgl_finish)}`
            + ` (${Number(r.jumlah_hari)} hari) | ${r.nama_pesanan}`
            + ` | status: ${statusLabel(r.status)}`
            + ` | total: Rp ${uang(r.grand_total)}`
            + ` | nopol: ${r.nopol || "-"}`
            + ` | driver: ${r.driver || "-"}`
            + ` | PIC: ${r.nama_pic || "-"}${r.hp_pic ? ` (${r.hp_pic})` : ""}`
            + ` | kota: ${r.kota}\n`;
    });
    return out;
}

const PILIH_PESANAN = `o.nomor_order, o.nama_pesanan, o.kota, o.tgl_mulai, o.tgl_finish, o.jumlah_hari,
                       o.status, o.grand_total, o.nama_pic, o.hp_pic, o.standby_point,
                       (SELECT GROUP_CONCAT(DISTINCT i.nopol SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) nopol,
                       (SELECT GROUP_CONCAT(DISTINCT i.nama_driver SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) driver`;

/** PESANAN HARI INI / SEDANG BERJALAN — port Asisten::pesananHariIni. */
export async function pesananHariIni(): Promise<string> {
    const hariIni = sekarangJakarta();
    const rows = await query<BarisPesanan>(
        `SELECT ${PILIH_PESANAN} FROM orders o
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
           AND (o.tgl_mulai <= ? AND o.tgl_finish >= ? OR o.tgl_mulai = ?)
         ORDER BY o.tgl_mulai LIMIT 25`,
        [hariIni, hariIni, hariIni],
    );
    return formatPesanan("PESANAN HARI INI / SEDANG BERJALAN", rows);
}

/** HASIL PENCARIAN — port Asisten::cariPesanan. */
export async function cariPesanan(kata: string): Promise<string> {
    const like = `%${kata}%`;
    const rows = await query<BarisPesanan>(
        `SELECT ${PILIH_PESANAN} FROM orders o
         WHERE o.deleted_at IS NULL
           AND (o.nomor_order LIKE ? OR o.nama_pesanan LIKE ? OR o.nama_pic LIKE ? OR o.kota LIKE ?
                OR EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.nopol LIKE ?)
                OR EXISTS (SELECT 1 FROM invoices v WHERE v.order_id = o.id AND v.nomor_invoice LIKE ?))
         ORDER BY o.tgl_mulai DESC LIMIT 15`,
        [like, like, like, like, like, like],
    );
    return formatPesanan(`HASIL PENCARIAN "${kata}"`, rows);
}

/** INVOICE BELUM LUNAS — port Asisten::invoiceBelumLunas. */
export async function invoiceBelumLunas(): Promise<string> {
    const rows = await query<BarisInvoice>(
        `SELECT i.nomor_invoice, i.tanggal_invoice, i.jatuh_tempo, i.total, i.dp, i.sisa, i.status,
                o.nomor_order, o.nama_pesanan, o.nama_pic, o.hp_pic
         FROM invoices i JOIN orders o ON o.id = i.order_id
         WHERE i.status IN ('terbit','sebagian') AND o.deleted_at IS NULL
           AND o.status NOT IN ('cancelled','closed')
         ORDER BY i.jatuh_tempo`,
    );
    if (rows.length === 0) {
        return "INVOICE BELUM LUNAS: tidak ada. Semua invoice sudah lunas atau belum terbit.\n";
    }
    let out = `INVOICE BELUM LUNAS (${rows.length} invoice)\n`;
    let tot = 0;
    rows.forEach((r, i) => {
        tot += Number(r.sisa);
        out += `${i + 1}. ${r.nomor_invoice} | pesanan ${r.nomor_order} - ${r.nama_pesanan}`
            + ` | terbit ${tglAngka(r.tanggal_invoice)} | jatuh tempo ${tglAngka(r.jatuh_tempo)}`
            + ` | total Rp ${uang(r.total)}`
            + ` | dibayar Rp ${uang(r.dp)}`
            + ` | SISA Rp ${uang(r.sisa)}`
            + ` | status ${statusLabel(r.status)}`
            + ` | PIC ${r.nama_pic || "-"}${r.hp_pic ? ` (${r.hp_pic})` : ""}\n`;
    });
    out += `TOTAL SISA TAGIHAN: Rp ${uang(tot)}\n`;
    return out;
}

/**
 * REKAP PER BULAN — port Asisten::rekapBulanan.
 * Margin hanya ditampilkan bila peran berhak 'lihat_modal'.
 */
export async function rekapBulanan(role: Role, jumlahBulan = 6): Promise<string> {
    const bolehMargin = bolehLihatModal(role);
    const hariIni = sekarangJakarta();

    let out = "REKAP PER BULAN (berdasarkan tanggal mulai sewa; pesanan batal/tertutup & historis tanpa invoice dikecualikan)\n";
    for (let i = jumlahBulan - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(Number(hariIni.slice(0, 4)), Number(hariIni.slice(5, 7)) - 1 - i, 1));
        const awal = d.toISOString().slice(0, 10);
        const akhir = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
        const r = await queryOne<{ c: number; j: number | string; m: number | string }>(
            `SELECT COUNT(*) c, COALESCE(SUM(o.grand_total),0) j, COALESCE(SUM(o.margin),0) m
             FROM orders o
             WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
               AND NOT (o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM invoices iv WHERE iv.order_id = o.id AND iv.status <> 'batal'))
               AND o.tgl_mulai BETWEEN ? AND ?`,
            [awal, akhir],
        );
        out += `- ${bulanPanjang(d.getUTCMonth() + 1)} ${d.getUTCFullYear()}`
            + `: ${Number(r?.c ?? 0)} pesanan, nilai Rp ${uang(r?.j ?? 0)}`
            + (bolehMargin ? `, margin internal Rp ${uang(r?.m ?? 0)}` : "")
            + "\n";
    }
    return out;
}

/** CEK KETERSEDIAAN — port Asisten::cekKetersediaan. */
export async function cekKetersediaan(kode: string, mulai: string, sampai: string): Promise<string> {
    const like = `%${kode}%`;
    const padat = kode.replace(/\s+/g, "");
    const likePadat = `%${padat}%`;
    const units = await query<{ id: number; nama_unit: string; nopol: string; status: string; dipakai: number }>(
        `SELECT u.id, u.nama_unit, u.nopol, u.status,
                (SELECT COUNT(*) FROM order_items i WHERE i.unit_id = u.id) dipakai
         FROM units u
         WHERE u.deleted_at IS NULL
           AND (u.nopol LIKE ? OR REPLACE(u.nopol, ' ', '') LIKE ? OR u.nama_unit LIKE ?)
         LIMIT 5`,
        [like, likePadat, like],
    );
    if (units.length === 0) {
        return `CEK KETERSEDIAAN "${kode}" (${mulai} s/d ${sampai}): unit dengan nopol/nama itu tidak ada di data master.\n`
            + "PENTING: kalau pengguna hanya menyebut nama unit tanpa nopol yang pasti, katakan datanya tidak ditemukan dan minta nopolnya.\n";
    }
    let out = `CEK KETERSEDIAAN UNIT "${kode}" (${mulai} s/d ${sampai})\n`;
    for (const u of units) {
        const pakai = await query<{ nomor_order: string; nama_pesanan: string; tgl_mulai: string; tgl_finish: string; status: string }>(
            `SELECT o.nomor_order, o.nama_pesanan, o.tgl_mulai, o.tgl_finish, o.status
             FROM order_items i JOIN orders o ON o.id = i.order_id
             WHERE i.unit_id = ? AND o.deleted_at IS NULL
               AND o.status NOT IN ('cancelled','closed','draft')
               AND NOT (o.tgl_finish < ? OR o.tgl_mulai > ?)
             ORDER BY o.tgl_mulai`,
            [Number(u.id), mulai, sampai],
        );
        out += `- ${u.nama_unit} (${u.nopol}), status master: ${u.status}`
            + `, total pernah dipakai ${Number(u.dipakai)} pesanan. `;
        if (pakai.length === 0) {
            out += "BEBAS pada rentang tanggal itu (tidak ada pesanan bertumpuk).\n";
        } else {
            out += "TIDAK BEBAS, bertumpuk dengan: "
                + pakai.map((pp) => `${pp.nomor_order} (${tglAngka(pp.tgl_mulai)}-${tglAngka(pp.tgl_finish)}, ${pp.nama_pesanan})`).join("; ")
                + "\n";
        }
    }
    return out;
}

/** DATA MASTER — port Asisten::master. */
export async function master(kata: string): Promise<string> {
    const like = `%${kata}%`;
    let out = `DATA MASTER COCOK "${kata}"\n`;

    const u = await query<{ nama_unit: string; nopol: string; status: string; harga_jual_default: number | string }>(
        `SELECT nama_unit, nopol, status, harga_jual_default FROM units
         WHERE deleted_at IS NULL AND (nama_unit LIKE ? OR nopol LIKE ?) LIMIT 10`,
        [like, like],
    );
    out += "- Unit:\n";
    for (const r of u) {
        out += `  ${r.nama_unit} (${r.nopol}) status ${r.status}`
            + `, harga jual default Rp ${uang(r.harga_jual_default)}\n`;
    }
    if (u.length === 0) {
        out += "  (tidak ada)\n";
    }

    const d = await query<{ nama: string; hp: string | null; wilayah: string | null; status: string }>(
        `SELECT nama, hp, wilayah, status FROM drivers
         WHERE deleted_at IS NULL AND nama LIKE ? LIMIT 10`,
        [like],
    );
    out += "- Driver:\n";
    for (const r of d) {
        out += `  ${r.nama} | HP ${r.hp || "-"} | wilayah ${r.wilayah || "-"} | status ${r.status}\n`;
    }
    if (d.length === 0) {
        out += "  (tidak ada)\n";
    }
    return out;
}

/** Deteksi maksud pertanyaan + susun konteks data — port Asisten::konteks. */
export async function konteks(tanya: string, role: Role): Promise<{ teks: string; label: string[] }> {
    const t = ` ${tanya.toLowerCase()} `;
    const bagian: string[] = [];
    const label: string[] = [];

    const bulanId: Record<string, number> = {
        januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
        juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
    };

    /* 1. ketersediaan unit + tanggal */
    const mNopol = /\b([A-Z]{1,2}\s?\d{3,4}\s?[A-Z]{1,3})\b/.exec(tanya);
    if (/(kosong|tersedia|bebas|bentrok|bisa dipakai|dipakai|terpakai|availab)/i.test(tanya) && mNopol) {
        let mulai: string | null = null;
        let sampai: string | null = null;
        const mTgl = /\b(\d{4}-\d{2}-\d{2})\b/.exec(tanya);
        if (mTgl) {
            mulai = sampai = mTgl[1];
        } else {
            const mR = /(\d{1,2})\s*[-–s/]+\s*(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})?/i.exec(tanya);
            if (mR) {
                const bln = bulanId[mR[3].toLowerCase()] ?? 0;
                const thn = mR[4] || sekarangJakarta().slice(0, 4);
                if (bln) {
                    mulai = `${thn}-${String(bln).padStart(2, "0")}-${String(Number(mR[1])).padStart(2, "0")}`;
                    sampai = `${thn}-${String(bln).padStart(2, "0")}-${String(Number(mR[2])).padStart(2, "0")}`;
                }
            } else {
                const mS = /(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})?/.exec(tanya);
                if (mS) {
                    const bln = bulanId[mS[2].toLowerCase()] ?? 0;
                    const thn = mS[3] || sekarangJakarta().slice(0, 4);
                    if (bln) {
                        mulai = sampai = `${thn}-${String(bln).padStart(2, "0")}-${String(Number(mS[1])).padStart(2, "0")}`;
                    }
                }
            }
        }
        if (mulai && sampai && sampai < mulai) {
            const tmp = mulai;
            mulai = sampai;
            sampai = tmp;
        }
        if (!mulai) {
            mulai = sampai = sekarangJakarta();
        }
        bagian.push(await cekKetersediaan(mNopol[1], mulai, sampai as string));
        label.push("ketersediaan unit");
    }

    /* 2. invoice / tagihan */
    if (/(invoice|tagihan|belum lunas|belum bayar|piutang|sisa bayar|bayar)/i.test(tanya)) {
        bagian.push(await invoiceBelumLunas());
        label.push("invoice belum lunas");
    }

    /* 3. hari ini / sedang berjalan */
    if (/(\bhari ini\b|\bsekarang\b|\bsedang\b|\bsedang trip\b|\bunit keluar\b|\bberjalan\b|\bhari ini apa\b)/i.test(t)) {
        bagian.push(await pesananHariIni());
        label.push("pesanan hari ini");
    }

    /* 4. rekap / pendapatan / total bulan */
    if (/(rekap|omzet|omset|pendapatan|margin|laba|total (bulan|per bulan)|bulan ini|tahun ini)/i.test(tanya)
        || /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.test(tanya)) {
        bagian.push(await rekapBulanan(role, 6));
        label.push("rekap bulanan");
    }

    /* 5. pencarian pesanan: nomor order / nama / nopol / pic / kota */
    const kataKunci: string[] = [];
    const mNo = /\b(RN-\d{4}-\d{4})\b/i.exec(tanya);
    if (mNo) {
        kataKunci.push(mNo[1]);
    }
    const mPola = /\b([A-Z]{1,2}\s?\d{3,4}\s?[A-Z]{1,3})\b/.exec(tanya);
    if (mPola) {
        kataKunci.push(mPola[1].replace(/\s+/g, ""));
    }
    const mPt = /\b(?:pt\.?|cv|ud|kabupaten|kantor|dinas|bank|polres|universitas|sekolah)\s+([A-Za-z.' ]{3,40})/i.exec(tanya);
    if (mPt) {
        kataKunci.push(mPt[1].trim());
    }
    const mPs = /(?:pesanan|order|atas nama|pelanggan|pic|untuk)\s+([A-Za-z.' ]{3,40})/i.exec(tanya);
    if (mPs) {
        kataKunci.push(mPs[1].trim());
    }

    for (const kkRaw of [...new Set(kataKunci)]) {
        const kk = kkRaw.trim();
        if (kk.length < 3) {
            continue;
        }
        bagian.push(await cariPesanan(kk));
        label.push(`pencarian: ${kk}`);
    }

    /* 6. data master unit/driver kalau tidak ada hasil lain */
    if (bagian.length === 0 && /(unit|driver|mobil|armada|master)/i.test(tanya)) {
        let kata = tanya.replace(/\b(unit|driver|mobil|armada|master|ada|berapa|apa|siapa|data|yang|di|ini)\b/gi, " ");
        kata = kata.trim().replace(/\s+/g, " ");
        if (kata.length >= 3) {
            bagian.push(await master(kata));
            label.push("data master");
        }
    }

    bagian.unshift(await ringkasan());
    return { teks: bagian.join("\n"), label };
}

/* ==================== PEMANGGILAN MODEL ==================== */

export interface JawabanAsisten {
    ok: boolean;
    jawaban?: string;
    model?: string;
    konteks_label?: string;
    error?: string;
}

interface BagianModel {
    text?: string;
}

interface JawabanGemini {
    candidates?: Array<{ content?: { parts?: BagianModel[] } }>;
    error?: { message?: string };
}

/** Panggil model Gemini (utama + cadangan). */
async function panggilModel(cfg: KonfigAsisten, tubuh: unknown): Promise<{ teks: string; model: string } | { galat: string }> {
    const models = [cfg.model, ...cfg.modelCadangan].filter((m) => m !== "");
    let galat = "tidak ada model yang dicoba";
    for (const model of models) {
        const url = `${cfg.baseUrl}/models/${model}:generateContent`;
        const kendali = new AbortController();
        const pewaktu = setTimeout(() => kendali.abort(), 60000);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
                body: JSON.stringify(tubuh),
                signal: kendali.signal,
            });
            const teks = await res.text();
            let json: JawabanGemini = {};
            try {
                json = JSON.parse(teks) as JawabanGemini;
            } catch {
                json = {};
            }
            if (!res.ok) {
                galat = `HTTP ${res.status} dari model ${model}: ${String(json.error?.message ?? teks).slice(0, 200)}`;
                continue;
            }
            let keluar = "";
            for (const part of json.candidates?.[0]?.content?.parts ?? []) {
                keluar += String(part.text ?? "");
            }
            keluar = keluar.trim();
            if (keluar === "") {
                galat = `Model ${model} mengembalikan jawaban kosong.`;
                continue;
            }
            return { teks: keluar, model };
        } catch (e) {
            galat = `Koneksi ke layanan jawaban gagal: ${e instanceof Error ? e.message : String(e)}`;
            continue;
        } finally {
            clearTimeout(pewaktu);
        }
    }
    return { galat };
}

const PROMPT_SISTEM_AWAL = `Kamu adalah asisten internal dashboard reservasi 1000 Nusantara Rental.

ATURAN WAJIB:
1. Jawab HANYA dari KONTEKS DATA di bawah. Jangan memakai pengetahuan di luar itu.
2. Kalau data yang ditanya tidak ada di konteks, bilang jujur bahwa datanya tidak ada di sistem dan sebutkan menu mana yang bisa dipakai untuk mencarinya.
3. Jangan mengarang nomor order, nomor invoice, harga, nama unit, atau tanggal.
4. Kamu hanya bisa MEMBACA data. Kalau diminta mengubah/menghapus/membuat data, tolak dengan sopan dan arahkan ke menu yang sesuai.
5. Uang ditulis format Rp 1.234.567. Tanggal ditulis 30-09-2026.
6. Bahasa Indonesia, ringkas dan langsung ke inti, tanpa emoji, tanpa basa-basi berlebihan.
7. Kalau jawabannya berupa daftar, pakai daftar bernomor singkat; sebutkan angka kunci (jumlah, sisa tagihan).
8. FORMAT JAWABAN (wajib, supaya rapi di layar sempit):
   - Mulai dengan 1 kalimat inti yang memuat angka kunci. Contoh: "Ada 1 pesanan berjalan hari ini."
   - Kalau ada rincian, tulis SETIAP data pada satu baris sendiri, diawali "- ", dengan urutan tetap:
     NOMOR ORDER · TANGGAL · NAMA PESANAN · STATUS · Rp NILAI
     Setiap bagian dipisahkan " · " (spasi, titik tengah, spasi). Maksimal 6 baris rincian.
     Kalau datanya lebih dari 6, tambahkan baris terakhir: "dan N data lain - buka menu Data Pesanan & Faktur".
   - Untuk invoice pakai urutan: NOMOR INVOICE · PESANAN · JATUH TEMPO · SISA Rp NILAI
   - Untuk ketersediaan unit: baris pertama langsung jawab BEBAS / TIDAK BEBAS, lalu baris rincian bila ada.
   - JANGAN memakai tanda bintang, tanda pagar, tabel markdown, atau emoji.
   - Jangan mengulang-ulang judul konteks; langsung ke isi. Hindari kalimat pembuka seperti "Berikut adalah".
   - Kalau menolak permintaan atau data tidak ada, cukup 1-2 kalimat.

KONTEKS DATA:
`;

/** Tanya asisten — port Asisten::tanya. */
export async function tanya(
    pertanyaan: string,
    riwayat: Array<{ role: string; text: string }> = [],
    role: Role = "reservasi",
): Promise<JawabanAsisten> {
    const cfg = konfig();
    if (cfg.apiKey === "") {
        return { ok: false, error: "Asisten AI belum aktif. Fitur ini akan segera hadir." };
    }

    const { teks: konteksData, label } = await konteks(pertanyaan, role);
    const system = `${PROMPT_SISTEM_AWAL}${konteksData}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const turn of riwayat.slice(-6)) {
        const teksTurn = String(turn.text ?? "").trim();
        if (teksTurn === "") {
            continue;
        }
        contents.push({
            role: (turn.role ?? "user") === "asisten" ? "model" : "user",
            parts: [{ text: teksTurn }],
        });
    }
    contents.push({ role: "user", parts: [{ text: pertanyaan }] });

    const hasil = await panggilModel(cfg, {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
    });
    if ("galat" in hasil) {
        return { ok: false, error: hasil.galat };
    }
    return { ok: true, jawaban: hasil.teks, model: hasil.model, konteks_label: [...new Set(label)].join(", ") };
}

/**
 * AI pembaca teks -> JSON (penambal Bedah teks) — port AsistenParse.php.
 * Dipakai HANYA ketika pembaca pola gagal membaca sebagian field; hasilnya
 * selalu direview pengguna sebelum disimpan.
 */
export async function asistenParseJson(teks: string): Promise<{ ok: boolean; json?: unknown; model?: string; error?: string }> {
    const cfg = konfig();
    if (cfg.apiKey === "") {
        return { ok: false, error: "Asisten AI belum aktif. Fitur ini akan segera hadir." };
    }

    const system = `Kamu mesin pembaca teks pesanan rental mobil berbahasa Indonesia.
Ubah teks konfirmasi reservasi yang diberikan menjadi JSON. Balas HANYA JSON, tanpa penjelasan.

Skema yang wajib dikembalikan:
{
  "wilayah_pelayanan": "dalam_kota" | "luar_kota",
  "kota": "nama kota",
  "tgl_mulai": "YYYY-MM-DD",
  "tgl_finish": "YYYY-MM-DD",
  "jumlah_hari": angka,
  "jam": "teks jam atau kosong",
  "jam_koordinasi": 0 atau 1,
  "standby_point": "teks atau kosong",
  "flight": "kode/teks flight atau kosong",
  "nama_pesanan": "nama pemesan/instansi",
  "nama_pic": "nama PIC",
  "hp_pic": "nomor HP PIC",
  "items": [{"nama_unit":"","nopol":"","nama_driver":"","hp_driver":"","harga_jual_per_hari":0}],
  "includes": ["nama include"],
  "biaya": [{"nama":"","nominal":0}],
  "total_teks": angka
}

Aturan:
1. Ambil HANYA yang tertulis. Jangan mengarang nilai yang tidak ada; kosongkan ("" atau 0 atau []).
2. Jika ada beberapa kendaraan, isi semuanya di dalam array items.
3. Baris 'Hp/Wa' pertama milik driver, yang muncul setelah 'Pic' milik PIC.
4. tanggal keluaran selalu format YYYY-MM-DD; angka tanpa titik/pemisah.
5. 'Jam' yang berisi 'koordinasi' -> jam_koordinasi = 1 dan jam = "".
6. Nama perusahaan pengirim (mis. 'PT. Seribu Nusantara Rental') BUKAN nama pesanan.
`;

    const hasil = await panggilModel(cfg, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: teks }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1500, responseMimeType: "application/json" },
    });
    if ("galat" in hasil) {
        return { ok: false, error: hasil.galat };
    }
    const keluar = hasil.teks.replace(/^```(?:json)?|```$/gm, "");
    let isi: unknown;
    try {
        isi = JSON.parse(keluar.trim());
    } catch {
        isi = null;
    }
    if (typeof isi !== "object" || isi === null || Array.isArray(isi)) {
        return { ok: false, error: `Model ${hasil.model} tidak mengembalikan JSON valid.` };
    }
    return { ok: true, json: isi, model: hasil.model };
}

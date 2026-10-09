import "server-only";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { queryOne, transaction } from "@/lib/db";
import { rapikanNilai } from "@/lib/master-server";
import { angka, normalisasiHp, hitungHari, DAFTAR_STATUS } from "@/lib/format";
import { nomorDokumen, hitungOrder, catatStatus, mapAsalUser } from "@/lib/app-lib";
import { panggilanReservasi, type SesiUser } from "@/lib/auth";
import type { FlashData } from "@/lib/flash";

/*
 * Import — port 1:1 dari ImportController.php (yang sendiri salinan
 * pages/import.php + pages/import_xlsx.php sistem lama).
 *
 * Aturan yang dipertahankan:
 * - Data yang sudah ada DILEWATI (tidak ditimpa, tidak dihapus).
 * - Tiap baris berdiri sendiri: satu baris gagal tidak menggugurkan baris lainnya.
 * - Nama kolom yang dikenali sama persis dengan sistem lama.
 *
 * Catatan port: Laravel memakai EnumSehat::baris() untuk menyelaraskan nilai
 * ENUM dengan perilaku MySQL non-strict; di sini padanannya rapikanNilai().
 */

/* ============================== TEMPLATE CSV ============================== */

/** Nama kolom yang dikenali per jenis import (verbatim dari controller). */
export const KOLOM_TEMPLATE: Record<string, string[]> = {
    unit: ["nama_unit", "nopol", "kode_unit", "jenis", "tahun", "transmisi", "kapasitas", "pemilik", "harga_modal_default", "harga_jual_default", "status"],
    driver: ["nama", "hp", "wilayah", "nomor_sim", "bank", "no_rekening", "status"],
    customer: ["nama_pesanan", "tipe", "nama_pic", "hp_pic", "email", "alamat", "sumber", "status"],
    pesanan: ["nama_pesanan", "nama_pic", "hp_pic", "kota", "wilayah_pelayanan", "tgl_mulai", "tgl_finish",
        "jam", "standby_point", "flight", "unit", "nopol", "driver", "harga_modal_per_hari",
        "harga_jual_per_hari", "include", "status", "catatan"],
};

/* ============================== IMPORT CSV ============================== */

export type StatusBaris = "ok" | "lewati" | "gagal";
/** [baris ke-, status, keterangan] — bentuk sama dengan $hasil di controller. */
export type BarisHasil = [number, StatusBaris, string];

export interface RingkasImport {
    masuk: number;
    lewati: number;
    gagal: number;
}

/** Bentuk flash modul import CSV (kunci tambahan di luar FlashData bawaan). */
export interface FlashImportCsv extends FlashData {
    hasil_import?: BarisHasil[];
}

export interface BarisCsv {
    /** Nomor baris di berkas (baris pertama = header, jadi data mulai 2). */
    nomor: number;
    row: Record<string, string>;
}

/** Pisah satu baris CSV mengikuti aturan str_getcsv (kutip ganda dihormati). */
function pisahCsv(baris: string, pemisah: string): string[] {
    const keluar: string[] = [];
    let cur = "";
    let dalamKutip = false;
    for (let i = 0; i < baris.length; i++) {
        const c = baris[i];
        if (dalamKutip) {
            if (c === '"') {
                if (baris[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    dalamKutip = false;
                }
            } else {
                cur += c;
            }
        } else if (c === '"') {
            dalamKutip = true;
        } else if (c === pemisah) {
            keluar.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    keluar.push(cur);
    return keluar;
}

/**
 * Baca isi CSV: buang BOM, pisah baris, deteksi pemisah `;` lalu `,` bila kolom < 2,
 * nama kolom di-lowercase + trim.
 */
export function parseCsv(isi: string): { head: string[]; baris: BarisCsv[] } {
    const teks = isi.replace(/^\uFEFF/, "");
    const garis = teks.split(/\r\n|\n|\r/);
    const barisHead = garis.shift() ?? "";

    let head = pisahCsv(barisHead, ";");
    if (head.length < 2) {
        head = pisahCsv(head.join(";"), ",");
    }
    head = head.map((h) => h.trim().toLowerCase());

    const baris: BarisCsv[] = [];
    garis.forEach((line, i) => {
        if (line.trim() === "") {
            return;
        }
        let kolomBaris = pisahCsv(line, ";");
        if (kolomBaris.length < 2) {
            kolomBaris = pisahCsv(line, ",");
        }
        const row: Record<string, string> = {};
        head.forEach((nama, idx) => {
            row[nama] = (kolomBaris[idx] ?? "").trim();
        });
        baris.push({ nomor: i + 2, row });
    });

    return { head, baris };
}

/** Perubahan satu baris: entri hasil + pekerjaan yang dijalankan setelah transaksi commit. */
interface HasilBaris {
    status: "ok" | "lewati";
    pesan: string;
    pasca?: () => Promise<void>;
}

function pesanError(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

function pad(n: number, lebar: number): string {
    return String(n).padStart(lebar, "0");
}

/** ubah "27/09/2026" atau "2026-09-27" jadi Y-m-d (port tglCsv). */
function tglCsv(s: string): string | null {
    const teks = s.trim();
    if (teks === "") {
        return null;
    }
    let m = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        return `${m[1]}-${m[2]}-${m[3]}`;
    }
    m = teks.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
        const hh = Number(m[1]);
        const bb = Number(m[2]);
        let tt = Number(m[3]);
        if (tt < 100) {
            tt += 2000;
        }
        return `${pad(tt, 4)}-${pad(bb, 2)}-${pad(hh, 2)}`;
    }
    const t = new Date(teks);
    return Number.isNaN(t.getTime()) ? null : `${t.getFullYear()}-${pad(t.getMonth() + 1, 2)}-${pad(t.getDate(), 2)}`;
}

/** INSERT satu baris setelah dirapikan sesuai jenis kolom; kembalikan insertId. */
async function insertBaris(
    conn: PoolConnection,
    tabel: string,
    data: Record<string, string | number | null>,
): Promise<number> {
    const rapi = await rapikanNilai(tabel, data);
    const kolom = Object.keys(rapi);
    const [res] = await conn.query(
        `INSERT INTO \`${tabel}\` (${kolom.map((k) => `\`${k}\``).join(", ")}) VALUES (${kolom.map(() => "?").join(", ")})`,
        kolom.map((k) => rapi[k]),
    );
    return (res as ResultSetHeader).insertId;
}

async function connOne<T>(
    conn: PoolConnection,
    sql: string,
    params: unknown[] = [],
): Promise<T | null> {
    const [rows] = await conn.query(sql, params);
    return (rows as T[])[0] ?? null;
}

/**
 * Import isi CSV. Tiap baris dijalankan dalam transaksinya sendiri supaya satu
 * baris gagal tidak menggugurkan baris lain (dan tulisan pasca-commit seperti
 * hitungOrder/catatStatus tidak pernah beradu kunci dengan transaksi yang masih terbuka).
 */
export async function importCsv(
    jenis: string,
    isi: string,
    user: SesiUser,
): Promise<{ hasil: BarisHasil[]; ringkas: RingkasImport }> {
    const { baris } = parseCsv(isi);
    const hasil: BarisHasil[] = [];
    const ringkas: RingkasImport = { masuk: 0, lewati: 0, gagal: 0 };

    for (const b of baris) {
        try {
            const hasilBaris = await transaction((conn) => barisCsv(conn, jenis, b.row, user));
            if (hasilBaris.pasca) {
                await hasilBaris.pasca();
            }
            hasil.push([b.nomor, hasilBaris.status, hasilBaris.pesan]);
            if (hasilBaris.status === "ok") {
                ringkas.masuk++;
            } else {
                ringkas.lewati++;
            }
        } catch (e) {
            hasil.push([b.nomor, "gagal", pesanError(e)]);
            ringkas.gagal++;
        }
    }

    return { hasil, ringkas };
}

/** Satu baris CSV -> tabel (unit / driver / customer / pesanan). */
async function barisCsv(
    conn: PoolConnection,
    jenis: string,
    row: Record<string, string>,
    user: SesiUser,
): Promise<HasilBaris> {
    if (jenis === "unit") {
        const nopol = (row.nopol ?? "").toUpperCase();
        const namaUnit = row.nama_unit ?? "";
        if (namaUnit === "" || nopol === "") {
            throw new Error("nama_unit dan nopol wajib ada.");
        }
        const ada = await connOne<{ id: number }>(conn, "SELECT id FROM units WHERE nopol = ? LIMIT 1", [nopol]);
        if (ada) {
            return { status: "lewati", pesan: `${namaUnit} (${nopol}) sudah ada` };
        }
        await insertBaris(conn, "units", {
            kode_unit: row.kode_unit ?? "",
            nama_unit: namaUnit,
            nopol,
            jenis: (row.jenis ?? "MPV").toUpperCase(),
            tahun: angka(row.tahun ?? 0) || null,
            transmisi: (row.transmisi ?? "").toLowerCase() || null,
            kapasitas: angka(row.kapasitas ?? 0) || null,
            pemilik: (row.pemilik ?? "sendiri") === "partner" ? "partner" : "sendiri",
            partner_id: null,
            harga_modal_default: angka(row.harga_modal_default ?? 0),
            harga_jual_default: angka(row.harga_jual_default ?? 0),
            status: (row.status ?? "") || "ready",
        });
        return { status: "ok", pesan: `${namaUnit} (${nopol}) ditambahkan` };
    }

    if (jenis === "driver") {
        const nama = row.nama ?? "";
        if (nama === "") {
            throw new Error("nama wajib ada.");
        }
        const ada = await connOne<{ id: number }>(
            conn,
            "SELECT id FROM drivers WHERE LOWER(nama) = LOWER(?) LIMIT 1",
            [nama],
        );
        if (ada) {
            return { status: "lewati", pesan: `${nama} sudah ada` };
        }
        await insertBaris(conn, "drivers", {
            nama,
            hp: normalisasiHp(row.hp ?? ""),
            wilayah: row.wilayah ?? "",
            nomor_sim: row.nomor_sim ?? "",
            bank: row.bank ?? "",
            no_rekening: row.no_rekening ?? "",
            status: (row.status ?? "") || "aktif",
        });
        return { status: "ok", pesan: `${nama} ditambahkan` };
    }

    if (jenis === "customer") {
        const nama = row.nama_pesanan ?? "";
        if (nama === "") {
            throw new Error("nama_pesanan wajib ada.");
        }
        const ada = await connOne<{ id: number }>(
            conn,
            "SELECT id FROM customers WHERE LOWER(nama_pesanan) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
            [nama],
        );
        if (ada) {
            return { status: "lewati", pesan: `${nama} sudah ada` };
        }
        await insertBaris(conn, "customers", {
            tipe: (row.tipe ?? "") || "perorangan",
            nama_pesanan: nama,
            nama_pic: row.nama_pic ?? "",
            hp_pic: normalisasiHp(row.hp_pic ?? ""),
            email: row.email ?? "",
            alamat: row.alamat ?? "",
            sumber: (row.sumber ?? "") || "wa",
            status: (row.status ?? "") || "baru",
        });
        return { status: "ok", pesan: `${nama} ditambahkan` };
    }

    if (jenis === "pesanan") {
        return barisPesananCsv(conn, row, user);
    }

    throw new Error("Jenis import tidak dikenal.");
}

/** Baris pesanan dari CSV (lengkap: customer, unit, driver, include). */
async function barisPesananCsv(
    conn: PoolConnection,
    row: Record<string, string>,
    user: SesiUser,
): Promise<HasilBaris> {
    const nama = row.nama_pesanan ?? "";
    const tglMulai = tglCsv(row.tgl_mulai ?? "");
    const tglFinish = tglCsv(row.tgl_finish ?? "");
    if (nama === "" || !tglMulai || !tglFinish) {
        throw new Error("nama_pesanan, tgl_mulai, tgl_finish wajib ada.");
    }
    const hari = hitungHari(tglMulai, tglFinish);
    if (hari < 1) {
        throw new Error("tanggal selesai lebih awal dari tanggal mulai.");
    }

    let nomor = (row.nomor_order ?? "").trim();
    if (nomor !== "") {
        const sudahAda = await connOne<{ id: number }>(
            conn,
            "SELECT id FROM orders WHERE nomor_order = ? LIMIT 1",
            [nomor],
        );
        if (sudahAda) {
            return { status: "lewati", pesan: `order ${nomor} sudah ada` };
        }
    } else {
        nomor = await nomorDokumen("order", await panggilanReservasi(user.id));
    }

    /* customer */
    const cust = await connOne<{ id: number }>(
        conn,
        "SELECT id FROM customers WHERE LOWER(nama_pesanan) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
        [nama],
    );
    let customerId: number;
    if (cust) {
        customerId = Number(cust.id);
    } else {
        customerId = await insertBaris(conn, "customers", {
            tipe: "instansi",
            nama_pesanan: nama,
            nama_pic: row.nama_pic ?? "",
            hp_pic: normalisasiHp(row.hp_pic ?? ""),
            sumber: "lainnya",
            status: "baru",
        });
    }

    /* unit + driver */
    const nopol = (row.nopol ?? "").toUpperCase();
    let namaUnit = row.unit ?? "";
    let unitId: number | null = null;
    if (nopol !== "") {
        const u = await connOne<{ id: number; nama_unit: string }>(
            conn,
            "SELECT id, nama_unit FROM units WHERE nopol = ? LIMIT 1",
            [nopol],
        );
        if (u) {
            unitId = Number(u.id);
            if (namaUnit === "") {
                namaUnit = String(u.nama_unit);
            }
        } else if (namaUnit !== "") {
            unitId = await insertBaris(conn, "units", {
                nama_unit: namaUnit,
                nopol,
                harga_modal_default: angka(row.harga_modal_per_hari ?? 0),
                harga_jual_default: angka(row.harga_jual_per_hari ?? 0),
            });
        }
    }
    if (namaUnit === "" || nopol === "") {
        throw new Error("unit dan nopol wajib ada.");
    }

    const namaDriver = row.driver ?? "";
    let driverId: number | null = null;
    let hpDriver = "";
    if (namaDriver !== "") {
        const d = await connOne<{ id: number; hp: string | null }>(
            conn,
            "SELECT id, hp FROM drivers WHERE LOWER(nama) = LOWER(?) LIMIT 1",
            [namaDriver],
        );
        if (d) {
            driverId = Number(d.id);
            hpDriver = normalisasiHp(d.hp ?? "");
        } else {
            driverId = await insertBaris(conn, "drivers", { nama: namaDriver, status: "aktif" });
        }
    }

    let jam = row.jam ?? "";
    let jamKoord = 0;
    if (/kordinas/i.test(jam) || jam === "-") {
        jamKoord = 1;
        jam = "";
    }
    let statusOrder = (row.status ?? "") || "booked";
    if (!(DAFTAR_STATUS as readonly string[]).includes(statusOrder)) {
        statusOrder = "booked";
    }

    const orderId = await insertBaris(conn, "orders", {
        nomor_order: nomor,
        customer_id: customerId,
        tipe_pelanggan: "retail",
        wilayah_pelayanan: (row.wilayah_pelayanan ?? "") === "luar_kota" ? "luar_kota" : "dalam_kota",
        kota: row.kota ?? "",
        tgl_mulai: tglMulai,
        tgl_finish: tglFinish,
        jumlah_hari: hari,
        jam,
        jam_koordinasi: jamKoord,
        standby_point: row.standby_point ?? "",
        flight: row.flight ?? "",
        tujuan: "",
        nama_pesanan: nama,
        nama_pic: row.nama_pic ?? "",
        hp_pic: normalisasiHp(row.hp_pic ?? ""),
        sumber: "lainnya",
        handle_by: user.nama,
        partner_id: null,
        status: statusOrder,
        catatan: row.catatan ?? "",
        created_by: user.id,
    });

    const modalHari = angka(row.harga_modal_per_hari ?? 0);
    const jualHari = angka(row.harga_jual_per_hari ?? 0);
    await conn.query(
        `INSERT INTO order_items (order_id, unit_id, driver_id, nama_unit, nopol, nama_driver, hp_driver,
            harga_modal_per_hari, harga_jual_per_hari, jumlah_hari, subtotal_modal, subtotal_jual, catatan)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            orderId, unitId, driverId, namaUnit, nopol, namaDriver, hpDriver,
            modalHari, jualHari, hari, modalHari * hari, jualHari * hari, "",
        ],
    );

    const incTeks = row.include ?? "";
    if (incTeks !== "") {
        for (const bagian of incTeks.split(/[+,;]/)) {
            const nm = bagian.trim();
            if (nm === "") {
                continue;
            }
            await conn.query(
                "INSERT INTO order_includes (order_id, include_id, nama, biaya) VALUES (?, NULL, ?, 0)",
                [orderId, nm],
            );
        }
    }

    return {
        status: "ok",
        pesan: `order ${nomor} dibuat (${nama})`,
        pasca: async () => {
            await hitungOrder(orderId);
            await catatStatus(orderId, null, statusOrder, "Import CSV", user.nama);
        },
    };
}

/* ============================== ALAT BANTU EXCEL ============================== */

/** Nilai sel Excel -> string/angka sederhana (rich text, formula, dan Date dinormalkan). */
export function nilaiSel(v: unknown): string | number | null {
    if (v === null || v === undefined) {
        return null;
    }
    if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
    }
    if (typeof v === "string" || typeof v === "number") {
        return v;
    }
    if (typeof v === "boolean") {
        return v ? 1 : 0;
    }
    if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (Array.isArray(o.richText)) {
            return (o.richText as Array<{ text?: unknown }>).map((t) => String(t?.text ?? "")).join("");
        }
        if ("result" in o) {
            return nilaiSel(o.result);
        }
        if (typeof o.text === "string") {
            return o.text;
        }
        if ("error" in o) {
            return String(o.error);
        }
    }
    return null;
}

function excelTrim(v: unknown): string {
    return String(v ?? "").trim();
}

function excelAngka(v: unknown): number {
    if (v === null || v === undefined || v === "") {
        return 0;
    }
    if (typeof v === "number") {
        return Math.round(v);
    }
    const s = String(v);
    const teks = s.trim();
    if (teks === "" || teks === "-") {
        return 0;
    }
    const n = Number(teks);
    if (!Number.isNaN(n)) {
        return Math.round(n);
    }
    const digit = s.replace(/[^0-9]/g, "");
    return digit === "" ? 0 : parseInt(digit, 10);
}

/** Deteksi apakah kolom Q = harga per hari atau total (aturan sama dengan sistem lama). */
function parseHargaJualPerHari(q: unknown, sTotal: unknown, hari: number, tambahanTeks: unknown): number {
    const qVal = excelAngka(q);
    const sVal = excelAngka(sTotal);
    if (hari <= 0) {
        return qVal > 0 ? qVal : sVal;
    }
    if (qVal <= 0) {
        return sVal > 0 ? Math.round(sVal / hari) : 0;
    }

    let tambahan = 0;
    const t = excelTrim(tambahanTeks);
    if (t !== "" && t !== "-") {
        const cocok = [...t.matchAll(/([0-9][0-9.,]*)\s*(rb|ribu|jt|juta)?/gi)];
        if (cocok.length > 0) {
            let kandidat = 0;
            for (const m of cocok) {
                let num = parseInt(String(m[1]).replace(/[^0-9]/g, "") || "0", 10);
                const sat = (m[2] ?? "").toLowerCase();
                if (sat === "rb" || sat === "ribu") {
                    num *= 1000;
                }
                if (sat === "jt" || sat === "juta") {
                    num *= 1000000;
                }
                if (sat === "" && num < 10000) {
                    continue;
                }
                if (num > kandidat) {
                    kandidat = num;
                }
            }
            tambahan = kandidat > 0 ? kandidat : excelAngka(t);
        } else {
            tambahan = excelAngka(t);
        }
    }

    const expected = qVal * hari + tambahan;
    if (sVal > 0 && Math.abs(expected - sVal) < Math.max(50000, sVal * 0.15)) {
        return qVal;
    }
    if (sVal > 0 && qVal === sVal && tambahan === 0) {
        return Math.round(qVal / hari);
    }

    const perHariDariTotal = Math.round(sVal / hari);
    if (qVal > 0 && perHariDariTotal > 0 && qVal > perHariDariTotal * 3) {
        return perHariDariTotal;
    }
    return qVal;
}

const BULAN_EXCEL: Record<string, number> = {
    jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3,
    apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7,
    agu: 8, ags: 8, agustus: 8, sep: 9, sept: 9, september: 9,
    okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12,
};

/** Tanggal Excel: serial number, objek tanggal, "01 Ags", "27/09/2026", "2026-09-27". */
export function parseTanggalExcel(val: unknown, defaultYear = 2026): string | null {
    if (val === null || val === undefined || val === "") {
        return null;
    }
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
    }
    if (typeof val === "number" && val > 30000 && val < 60000) {
        const dasar = Date.UTC(1899, 11, 30) + Math.trunc(val) * 86400000;
        return new Date(dasar).toISOString().slice(0, 10);
    }
    const s = String(val).trim().replace(/\s+/g, " ");
    if (s === "" || s === "-") {
        return null;
    }

    let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)$/u);
    if (m) {
        const b = BULAN_EXCEL[m[2].toLowerCase()];
        if (b) {
            return `${pad(defaultYear, 4)}-${pad(b, 2)}-${pad(Number(m[1]), 2)}`;
        }
    }
    m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
        const d = Number(m[1]);
        const mo = Number(m[2]);
        let y = Number(m[3]);
        if (y < 100) {
            y += 2000;
        }
        return `${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}`;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        return `${m[1]}-${m[2]}-${m[3]}`;
    }
    const t = new Date(s);
    if (Number.isNaN(t.getTime())) {
        return null;
    }
    return `${t.getFullYear()}-${pad(t.getMonth() + 1, 2)}-${pad(t.getDate(), 2)}`;
}

/* ============================== IMPORT EXCEL ============================== */

export interface BarisPratinjau {
    row: number;
    keterangan: string;
    handle: string;
    asal: string;
    unit: string;
    nopol: string;
    pemesan: string;
    tamu: string;
    mulai: string | null;
    finish: string | null;
    hari: number;
    hariExcel: number;
    panjar: number;
    total: number;
    masalah: string;
}

export interface RingkasExcel {
    total: number;
    siap: number;
    lewati: number;
    error: number;
}

export interface HasilExcel {
    masuk: number;
    lewati: number;
    gagal: number;
    log: string[];
}

/** Bentuk flash modul import Excel (kunci tambahan di luar FlashData bawaan). */
export interface FlashImportExcel extends FlashData {
    hasil_excel?: HasilExcel;
}

/*
 * Nilai unggahan bertipe Uint8Array: typing exceljs mendeklarasikan `interface Buffer`
 * global yang bertabrakan dengan Buffer Node, sehingga cast kecil diperlukan di load().
 */
export type BerkasExcel = Uint8Array;

async function muatSheet(buffer: BerkasExcel): Promise<ExcelJS.Worksheet | null> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    return wb.getWorksheet("Orderan") ?? wb.worksheets[0] ?? null;
}

/** Pratinjau maksimum 25 baris pertama + ringkas total/siap/error. */
export async function pratinjauExcel(
    buffer: BerkasExcel,
): Promise<{ preview: BarisPratinjau[]; ringkas: RingkasExcel }> {
    const ws = await muatSheet(buffer);
    const preview: BarisPratinjau[] = [];
    const ringkas: RingkasExcel = { total: 0, siap: 0, lewati: 0, error: 0 };
    if (!ws) {
        return { preview, ringkas };
    }

    const maxRow = Math.min(ws.rowCount || 0, 950);
    for (let row = 4; row <= maxRow; row++) {
        const sel = (kol: string): string | number | null => nilaiSel(ws.getCell(`${kol}${row}`).value);

        const dataPemesan = excelTrim(sel("K"));
        const unit = excelTrim(sel("D"));
        const nopol = excelTrim(sel("E"));
        if (dataPemesan === "" && unit === "" && nopol === "") {
            continue;
        }
        if (dataPemesan === "") {
            continue;
        }
        ringkas.total++;

        const hariExcel = excelAngka(sel("O"));
        const tglMulai = parseTanggalExcel(sel("M"));
        const tglFinish = parseTanggalExcel(sel("N"));
        const hariHitung = tglMulai && tglFinish ? hitungHari(tglMulai, tglFinish) : hariExcel;

        const masalah: string[] = [];
        if (!tglMulai) masalah.push("Mulai ?");
        if (!tglFinish) masalah.push("Finish ?");
        if (!nopol) masalah.push("Nopol ?");
        if (!unit) masalah.push("Unit ?");
        if (masalah.length > 0) {
            ringkas.error++;
        } else {
            ringkas.siap++;
        }

        if (preview.length < 25) {
            preview.push({
                row,
                keterangan: excelTrim(sel("A")),
                handle: excelTrim(sel("B")),
                asal: excelTrim(sel("C")),
                unit,
                nopol,
                pemesan: dataPemesan,
                tamu: excelTrim(sel("L")),
                mulai: tglMulai,
                finish: tglFinish,
                hari: hariHitung,
                hariExcel,
                panjar: excelAngka(sel("P")),
                total: excelAngka(sel("S")),
                masalah: masalah.join(", "),
            });
        }
    }

    return { preview, ringkas };
}

/** Import seluruh baris sheet Orderan (mulai baris 4, kolom A–AE). */
export async function importExcel(buffer: BerkasExcel, user: SesiUser): Promise<HasilExcel> {
    const ws = await muatSheet(buffer);
    const masukLewat: HasilExcel = { masuk: 0, lewati: 0, gagal: 0, log: [] };
    if (!ws) {
        return masukLewat;
    }

    const maxRow = Math.min(ws.rowCount || 0, 950);
    for (let row = 4; row <= maxRow; row++) {
        const sel = (kol: string): string | number | null => nilaiSel(ws.getCell(`${kol}${row}`).value);

        const keterangan = excelTrim(sel("A"));
        const handleBy = excelTrim(sel("B"));
        const asalUserRaw = excelTrim(sel("C"));
        const unitNama = excelTrim(sel("D"));
        const nopolRaw = excelTrim(sel("E")).toUpperCase();
        const asalUnit = excelTrim(sel("F"));
        const driverNamaRaw = excelTrim(sel("G"));
        const rute = excelTrim(sel("H"));
        let upgrade = excelTrim(sel("I"));
        if (upgrade === "-") {
            upgrade = "";
        }
        const includeRaw = excelTrim(sel("J"));
        const pemesan = excelTrim(sel("K"));
        const tamu = excelTrim(sel("L"));
        const mulaiRaw = sel("M");
        const finishRaw = sel("N");
        const hariExcel = excelAngka(sel("O"));
        const panjar = excelAngka(sel("P"));
        const qRaw = sel("Q");
        const rRaw = sel("R");
        const totalRp = excelAngka(sel("S"));
        const modalUnit = excelAngka(sel("T"));
        const gajiDriver = excelAngka(sel("U"));
        const bbm = excelAngka(sel("V"));
        const tollParkir = excelAngka(sel("W"));
        const rpLain = excelAngka(sel("X"));
        const ketBiaya = excelTrim(sel("Y"));
        const totalPengeluaran = excelAngka(sel("Z"));
        const statusBayar = excelTrim(sel("AD"));
        const statusUnit = excelTrim(sel("AE"));

        if (pemesan === "" && unitNama === "" && nopolRaw === "") {
            continue;
        }
        if (pemesan === "") {
            masukLewat.lewati++;
            continue;
        }

        const tglMulai = parseTanggalExcel(mulaiRaw);
        const tglFinish = parseTanggalExcel(finishRaw);
        if (!tglMulai || !tglFinish) {
            masukLewat.gagal++;
            masukLewat.log.push(`Baris ${row}: tanggal tidak valid (${pemesan})`);
            continue;
        }
        if (!nopolRaw || !unitNama) {
            masukLewat.gagal++;
            masukLewat.log.push(`Baris ${row}: unit/nopol kosong`);
            continue;
        }

        const nopol = nopolRaw.replace(/\s+/g, "");
        let hari = hitungHari(tglMulai, tglFinish);
        if (hari < 1) {
            hari = Math.max(1, hariExcel);
        }

        /* duplikat: pemesan + nopol + tgl_mulai */
        const dup = await queryOne<{ id: number }>(
            `SELECT o.id FROM orders AS o
             JOIN order_items AS i ON i.order_id = o.id
             WHERE o.nama_pesanan = ? AND o.tgl_mulai = ? AND i.nopol = ? AND o.deleted_at IS NULL
             LIMIT 1`,
            [pemesan, tglMulai, nopol],
        );
        if (dup) {
            masukLewat.lewati++;
            continue;
        }

        const map = mapAsalUser(asalUserRaw);
        const tipePelanggan = map.tipe;
        const sumber = map.sumber;

        let kota = rute;
        if (rute.includes(" - ")) {
            kota = rute.split(" - ")[0].trim();
        }
        if (rute.includes("-") && kota === rute) {
            kota = rute.split("-")[0].trim();
        }
        kota = kota.slice(0, 100);
        if (kota === "") {
            kota = "-";
        }

        let wilayah = "dalam_kota";
        const ruteLower = rute.toLowerCase();
        for (const tanda of ["sumatera", "palembang", "tapanuli", "brastagi", "sibolangit", "siantar"]) {
            if (ruteLower.includes(tanda)) {
                wilayah = "luar_kota";
                break;
            }
        }

        const hargaJualPerHari = parseHargaJualPerHari(qRaw, totalRp, hari, rRaw);
        let modalTotal = totalPengeluaran > 0 ? totalPengeluaran : modalUnit;
        if (modalTotal <= 0 && gajiDriver + bbm + tollParkir + rpLain > 0) {
            modalTotal = modalUnit + gajiDriver + bbm + tollParkir + rpLain;
        }
        const hargaModalPerHari = hari > 0 ? Math.round(modalTotal / hari) : modalTotal;

        const statusUnitLower = statusUnit.trim().toLowerCase();
        const statusBayarLower = statusBayar.trim().toLowerCase();
        let statusOrder: string;
        if (statusUnitLower === "cancel" || statusUnitLower === "batal") {
            statusOrder = "cancelled";
        } else if (statusBayarLower === "lunas") {
            statusOrder = "paid";
        } else if (statusUnitLower === "finish" || statusUnitLower === "selesai") {
            statusOrder = "completed";
        } else {
            statusOrder = "completed";
        }

        /* partner / support by dari Asal Unit */
        const asalUnitTrim = asalUnit.trim();
        const milikSendiri = asalUnitTrim === ""
            || asalUnitTrim.toLowerCase() === "1000 rent"
            || asalUnitTrim.toLowerCase() === "1000rent";

        const rTeks = rRaw === null || rRaw === undefined ? "" : String(rRaw);
        const namaPic = "";

        try {
            const pasca = await transaction(async (conn) => {
                let partnerId: number | null = null;
                if (!milikSendiri) {
                    const prow = await connOne<{ id: number }>(
                        conn,
                        "SELECT id FROM partners WHERE LOWER(nama) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
                        [asalUnitTrim],
                    );
                    partnerId = prow
                        ? Number(prow.id)
                        : await insertBaris(conn, "partners", { nama: asalUnitTrim });
                }

                /* unit */
                const urow = await connOne<{ id: number }>(
                    conn,
                    "SELECT id FROM units WHERE nopol = ? AND deleted_at IS NULL LIMIT 1",
                    [nopol],
                );
                let unitId: number;
                if (urow) {
                    unitId = Number(urow.id);
                } else {
                    unitId = await insertBaris(conn, "units", {
                        kode_unit: "IMP-" + nopol.replace(/[^A-Z0-9]/g, ""),
                        nama_unit: unitNama,
                        nopol,
                        jenis: "MPV",
                        pemilik: milikSendiri ? "sendiri" : "partner",
                        partner_id: milikSendiri ? null : partnerId,
                        harga_modal_default: hargaModalPerHari,
                        harga_jual_default: hargaJualPerHari,
                        status: "ready",
                    });
                }

                /* driver */
                let driverId: number | null = null;
                const driverNama = driverNamaRaw;
                if (driverNamaRaw !== "" && driverNamaRaw !== "-") {
                    const drow = await connOne<{ id: number }>(
                        conn,
                        "SELECT id FROM drivers WHERE LOWER(nama) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
                        [driverNamaRaw],
                    );
                    driverId = drow
                        ? Number(drow.id)
                        : await insertBaris(conn, "drivers", { nama: driverNamaRaw, status: "aktif" });
                }

                /* customer */
                const crow = await connOne<{ id: number }>(
                    conn,
                    "SELECT id FROM customers WHERE LOWER(nama_pesanan) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
                    [pemesan],
                );
                let customerId: number;
                if (crow) {
                    customerId = Number(crow.id);
                } else {
                    const tipeCust = /\b(PT|CV|UD|Dinas|Kantor|Badan|Otoritas|Bank|Universitas|Sekolah|Prov|Kab)\b/i.test(pemesan)
                        ? "instansi"
                        : "perorangan";
                    customerId = await insertBaris(conn, "customers", {
                        tipe: tipeCust,
                        nama_pesanan: pemesan,
                        nama_pic: namaPic,
                        hp_pic: "",
                        sumber,
                        status: "baru",
                    });
                }

                const nomor = await nomorDokumen("order", await panggilanReservasi(user.id));
                let catatanOrder = "";
                if (ketBiaya !== "" && ketBiaya !== "-") {
                    catatanOrder = ketBiaya;
                }
                if (rTeks !== "" && rTeks !== "-" && rTeks.length < 200) {
                    catatanOrder = `${catatanOrder} | Tambahan: ${rTeks}`.replace(/^[ |]+|[ |]+$/g, "");
                }

                const orderId = await insertBaris(conn, "orders", {
                    nomor_order: nomor,
                    customer_id: customerId,
                    tipe_pelanggan: tipePelanggan,
                    wilayah_pelayanan: wilayah,
                    kota,
                    tgl_mulai: tglMulai,
                    tgl_finish: tglFinish,
                    jumlah_hari: hari,
                    jam: "",
                    jam_koordinasi: 0,
                    standby_point: "",
                    flight: "",
                    tujuan: rute,
                    nama_pesanan: pemesan,
                    nama_pic: namaPic,
                    hp_pic: "",
                    data_tamu: tamu,
                    sumber,
                    asal_user_raw: asalUserRaw,
                    handle_by: handleBy,
                    partner_id: null,
                    panjar,
                    keterangan,
                    status: statusOrder,
                    catatan: catatanOrder,
                    created_by: user.id,
                });

                await conn.query(
                    `INSERT INTO order_items (order_id, unit_id, driver_id, partner_id, nama_unit, nopol,
                        upgrade, nama_driver, hp_driver, harga_modal_per_hari, harga_jual_per_hari, jumlah_hari,
                        subtotal_modal, subtotal_jual, catatan)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [
                        orderId, unitId, driverId, partnerId, unitNama, nopol, upgrade, driverNama, "",
                        hargaModalPerHari, hargaJualPerHari, hari,
                        hargaModalPerHari * hari, hargaJualPerHari * hari, "",
                    ],
                );

                /* include */
                if (includeRaw !== "" && includeRaw !== "-") {
                    for (const bagian of includeRaw.split(/[+,;]/)) {
                        const pinc = bagian.trim();
                        if (pinc === "") {
                            continue;
                        }
                        const incRow = await connOne<{ id: number; nama: string }>(
                            conn,
                            "SELECT id, nama FROM includes WHERE nama LIKE ? LIMIT 1",
                            [`%${pinc}%`],
                        );
                        await conn.query(
                            "INSERT INTO order_includes (order_id, include_id, nama, biaya) VALUES (?,?,?,0)",
                            [orderId, incRow ? Number(incRow.id) : null, incRow ? incRow.nama : pinc],
                        );
                    }
                }

                /* biaya tambahan dari kolom R (mis. "Ovt 6 Jam 900rb") */
                if (rTeks !== "" && rTeks !== "-") {
                    let nomTamb = 0;
                    if (/([0-9][0-9.,]*)\s*(rb|ribu|jt|juta)?/i.test(rTeks)) {
                        if (/ovt|overtime/i.test(rTeks)) {
                            const mm = rTeks.match(/([0-9]+)\s*(rb|ribu)/gi);
                            if (mm && mm.length > 0) {
                                const angkaTerakhir = mm[mm.length - 1].match(/[0-9]+/)?.[0] ?? "0";
                                nomTamb = parseInt(angkaTerakhir, 10) * 1000;
                            } else {
                                nomTamb = excelAngka(rTeks);
                            }
                        }
                        if (nomTamb === 0) {
                            const cand = excelAngka(rTeks);
                            if (cand > 10000) {
                                nomTamb = cand;
                            }
                        }
                    }
                    if (nomTamb > 0) {
                        await conn.query(
                            "INSERT INTO order_biaya (order_id, nama, nominal) VALUES (?,?,?)",
                            [orderId, "Overtime / Tambahan (dari Excel)", nomTamb],
                        );
                    }
                }

                return async () => {
                    await hitungOrder(orderId);
                    await catatStatus(orderId, null, statusOrder, `Import XLSX baris ${row} (${pemesan})`, user.nama);
                };
            });

            await pasca();
            masukLewat.masuk++;
        } catch (e) {
            masukLewat.gagal++;
            masukLewat.log.push(`Baris ${row} gagal: ${pesanError(e)}`);
        }
    }

    return masukLewat;
}

/* ============================== BERKAS SEMENTARA ============================== */

/** Simpan unggahan ke os.tmpdir() (JANGAN ke dalam repo) dan kembalikan nama berkasnya. */
export async function simpanSementara(buffer: BerkasExcel, userId: number): Promise<string> {
    const nama = `rn-import-${userId}-${randomBytes(6).toString("hex")}.xlsx`;
    await fs.writeFile(path.join(os.tmpdir(), nama), buffer);
    return nama;
}

/**
 * Jalur berkas sementara bila token sah dan berkasnya masih ada.
 * Token hanya nama berkas (basename) milik user itu — menolak path traversal.
 */
export async function jalurSementara(token: string, userId: number): Promise<string | null> {
    if (!token || token !== path.basename(token)) {
        return null;
    }
    if (!new RegExp(`^rn-import-${userId}-[0-9a-f]+\\.xlsx$`).test(token)) {
        return null;
    }
    const penuh = path.join(os.tmpdir(), token);
    try {
        await fs.access(penuh);
        return penuh;
    } catch {
        return null;
    }
}

/** Hapus berkas sementara setelah import (abaikan bila sudah hilang). */
export async function hapusSementara(penuh: string): Promise<void> {
    try {
        await fs.unlink(penuh);
    } catch {
        /* berkas memang sudah tidak ada */
    }
}

import "server-only";
import { query, queryOne } from "@/lib/db";
import { tglId, tglAngka, sekarangJakarta } from "@/lib/format";
import { roleBoleh, bolehLihatModal, labelRole, normalisasiRole, type Role } from "@/lib/akses";

/*
 * Laporan penjualan — port PERSIS app/Http/Controllers/LaporanController.php
 * (penjualan + driverDetail + periode). HANYA MEMBACA data.
 *
 * ATURAN PERAN (sama seperti Laravel):
 * - Super Admin & Finance : melihat SEMUA reservasi + baris TOTAL (kemampuan laporan.semua).
 * - Admin Reservasi       : hanya baris MILIKNYA SENDIRI (AND o.created_by = ?).
 * Kolom modal/margin disaring DI SERVER: peran tanpa lihat_modal tidak pernah menerima angkanya.
 */

/* ============================== BANTU TANGGAL ============================== */

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Tiruan strtotime() untuk "YYYY-MM-DD": pecah komponen lalu NORMALISASI lewat
 * Date.UTC (mis. 30 Feb -> 2 Mar, sama seperti PHP). Tanggal mustahil
 * (bulan 13, dsb) menghasilkan null seperti strtotime() yang bernilai false.
 */
function tsHari(tgl: string): { utc: Date; y: number; m: number; d: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tgl);
    if (!m) {
        return null;
    }
    const y = Number(m[1]);
    const b = Number(m[2]);
    const h = Number(m[3]);
    if (b < 1 || b > 12 || h < 1 || h > 31) {
        return null;
    }
    const utc = new Date(Date.UTC(y, b - 1, h));
    return { utc, y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

/* ============================== PERIODE ============================== */

export const MODE_PILIHAN = {
    harian: "Harian",
    mingguan: "Mingguan",
    bulanan: "Bulanan",
    tahunan: "Tahunan",
} as const;

export type ModePeriode = keyof typeof MODE_PILIHAN;

export interface Periode {
    mode: ModePeriode;
    acuan: string;
    mulai: string;
    sampai: string;
    /** Label gaya "14 Sep 2026 s/d 20 Sep 2026" (tglId) — dipakai halaman driver. */
    labelPeriode: string;
    modePilihan: typeof MODE_PILIHAN;
}

export interface KueriPeriode {
    mode?: string;
    acuan?: string;
}

/** Ambil rentang periode (harian/mingguan/bulanan/tahunan) dari query string. */
export function periode(q: KueriPeriode): Periode {
    const mode: ModePeriode = (q.mode as ModePeriode) in MODE_PILIHAN ? (q.mode as ModePeriode) : "bulanan";

    let acuan = String(q.acuan ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acuan)) {
        acuan = sekarangJakarta();
    }

    /* strtotime() gagal -> PHP memakai time()=0 (epoch 01-01-1970). */
    const t = tsHari(acuan) ?? { utc: new Date(Date.UTC(1970, 0, 1)), y: 1970, m: 1, d: 1 };

    let mulai: string;
    let sampai: string;
    switch (mode) {
        case "harian":
            mulai = sampai = `${t.y}-${pad2(t.m)}-${pad2(t.d)}`;
            break;
        case "mingguan": {
            /* hariKe = date('N', $ts): Senin=1 .. Minggu=7. */
            const wd = t.utc.getUTCDay();
            const hariKe = wd === 0 ? 7 : wd;
            mulai = ymd(new Date(Date.UTC(t.y, t.m - 1, t.d - (hariKe - 1))));
            sampai = ymd(new Date(Date.UTC(t.y, t.m - 1, t.d + (7 - hariKe))));
            break;
        }
        case "tahunan":
            mulai = `${t.y}-01-01`;
            sampai = `${t.y}-12-31`;
            break;
        default: /* bulanan */
            mulai = `${t.y}-${pad2(t.m)}-01`;
            sampai = ymd(new Date(Date.UTC(t.y, t.m, 0))); // date('Y-m-t')
    }

    return {
        mode,
        acuan,
        mulai,
        sampai,
        labelPeriode: tglId(mulai) + " s/d " + tglId(sampai),
        modePilihan: MODE_PILIHAN,
    };
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/* ============================== TIPE HASIL ============================== */

export interface SesiLaporan {
    id: number;
    role: Role;
}

/** Baris rekap per penanggung jawab. modal/margin HANYA ada bila peran berhak. */
export interface BarisReservasi {
    pembuat: string;
    username: string;
    peran: string;
    jml: number;
    jual: number;
    trip: number;
    unit: number;
    modal?: number;
    margin?: number;
}

export interface TotalReservasi {
    jml: number;
    jual: number;
    trip: number;
    unit: number;
    modal?: number;
    margin?: number;
}

export interface BarisKota {
    kota: string;
    provinsi: string;
    jml: number;
    jual: number;
    trip: number;
    unit: number;
}

export interface TotalKota {
    jml: number;
    jual: number;
    trip: number;
    unit: number;
}

export interface BarisMobil {
    unit_id: number;
    nama_unit: string;
    nopol: string;
    trip: number;
    hari: number;
    jual: number;
    modal?: number;
    margin?: number;
}

export interface TotalMobil {
    trip: number;
    hari: number;
    jual: number;
    modal?: number;
    margin?: number;
}

export interface BarisJenis {
    jenis: string;
    trip: number;
    jual: number;
}

export interface BarisDriver {
    driver_id: number;
    nama_driver: string;
    jenjang: string;
    trip: number;
    hari: number;
    unit: number;
    jual: number;
}

export interface TotalDriver {
    trip: number;
    hari: number;
    unit: number;
    jual: number;
}

export interface LaporanPenjualan {
    mode: ModePeriode;
    modePilihan: typeof MODE_PILIHAN;
    acuan: string;
    mulai: string;
    sampai: string;
    labelPeriode: string;
    baris: BarisReservasi[];
    total: TotalReservasi;
    perKota: BarisKota[];
    totalKota: TotalKota;
    perMobil: BarisMobil[];
    totalMobil: TotalMobil;
    perJenis: BarisJenis[];
    perDriver: BarisDriver[];
    totalDriver: TotalDriver;
    lihatSemua: boolean;
    bolehModal: boolean;
}

/** Baris mentah dari query (angka dari mysql2 sudah number). */
interface BarisRekap {
    created_by: number | null;
    jml: number;
    jual: number;
    modal: number;
    margin: number;
}

interface BarisRekapItem {
    created_by: number | null;
    trip: number;
    unit: number;
}

interface BarisRekapKota {
    kota: string | null;
    jml: number;
    jual: number;
}

interface BarisRekapKotaItem {
    kota: string | null;
    trip: number;
    unit: number;
}

interface BarisProvinsi {
    nama: string | null;
    provinsi: string | null;
}

interface BarisUser {
    id: number;
    username: string | null;
    nama: string | null;
    panggilan: string | null;
    role: string | null;
}

interface BarisMobilDb {
    unit_id: number | null;
    nama_unit: string | null;
    nopol: string | null;
    trip: number;
    hari: number;
    jual: number;
    modal: number;
}

interface BarisDriverDb {
    driver_id: number | null;
    nama_driver: string | null;
    jenjang: string | null;
    trip: number;
    hari: number;
    unit: number;
    jual: number;
}

interface BarisJenisDb {
    jenis: string | null;
    trip: number;
    jual: number;
}

/* ============================== REKAP PENJUALAN ============================== */

/** Rekap penjualan per reservasi/kota/mobil/driver/jenis untuk satu periode. */
export async function ambilLaporanPenjualan(q: KueriPeriode, user: SesiLaporan): Promise<LaporanPenjualan> {
    const p = periode(q);

    const lihatSemua = roleBoleh(user.role, "laporan.semua");
    const bolehModal = bolehLihatModal(user.role);

    /* Rangkaian WHERE disusun apa adanya seperti LaporanController::penjualan. */
    let syarat = "o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed') AND o.tgl_mulai BETWEEN ? AND ?";
    const param: unknown[] = [p.mulai, p.sampai];
    if (!lihatSemua) {
        syarat += " AND o.created_by = ?";
        param.push(user.id);
    }

    /* rekap per penanggung jawab */
    const rekap = new Map<number, BarisReservasi>();
    const rowsRekap = await query<BarisRekap>(
        `SELECT o.created_by, COUNT(*) jml, COALESCE(SUM(o.grand_total),0) jual,
                COALESCE(SUM(o.total_modal),0) modal, COALESCE(SUM(o.margin),0) margin
         FROM orders o WHERE ${syarat} GROUP BY o.created_by`,
        param,
    );
    for (const row of rowsRekap) {
        rekap.set(Number(row.created_by), {
            pembuat: "",
            username: "",
            peran: "",
            jml: Number(row.jml),
            jual: Number(row.jual),
            modal: Number(row.modal),
            margin: Number(row.margin),
            trip: 0,
            unit: 0,
        });
    }

    const rowsItem = await query<BarisRekapItem>(
        `SELECT o.created_by, COUNT(*) trip, COUNT(DISTINCT i.unit_id) unit
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${syarat} GROUP BY o.created_by`,
        param,
    );
    for (const row of rowsItem) {
        const k = Number(row.created_by);
        if (!rekap.has(k)) {
            rekap.set(k, { pembuat: "", username: "", peran: "", jml: 0, jual: 0, modal: 0, margin: 0, trip: 0, unit: 0 });
        }
        const d = rekap.get(k) as BarisReservasi;
        d.trip = Number(row.trip);
        d.unit = Number(row.unit);
    }

    /* ===== PENJUALAN PER KOTA PELAYANAN (1000 Nusantara punya banyak cabang) =====
       Kota = kota cabang yang melayani order (mis. Medan, Jakarta, Surabaya). */
    const rekapKota = new Map<string, BarisKota>();
    const rowsKota = await query<BarisRekapKota>(
        `SELECT o.kota, COUNT(*) jml, COALESCE(SUM(o.grand_total),0) jual
         FROM orders o
         WHERE ${syarat} AND o.kota IS NOT NULL AND o.kota <> ''
         GROUP BY o.kota`,
        param,
    );
    for (const row of rowsKota) {
        const nama = String(row.kota ?? "").trim();
        rekapKota.set(nama, { kota: nama, provinsi: "", jml: Number(row.jml), jual: Number(row.jual), trip: 0, unit: 0 });
    }

    const rowsKotaItem = await query<BarisRekapKotaItem>(
        `SELECT o.kota, COUNT(*) trip, COUNT(DISTINCT i.unit_id) unit
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${syarat} AND o.kota IS NOT NULL AND o.kota <> ''
         GROUP BY o.kota`,
        param,
    );
    for (const row of rowsKotaItem) {
        const nama = String(row.kota ?? "").trim();
        if (!rekapKota.has(nama)) {
            rekapKota.set(nama, { kota: nama, provinsi: "", jml: 0, jual: 0, trip: 0, unit: 0 });
        }
        const d = rekapKota.get(nama) as BarisKota;
        d.trip = Number(row.trip);
        d.unit = Number(row.unit);
    }

    /* provinsi tiap kota (dari master kota) untuk pengelompokan */
    const provinsiKota = new Map<string, string>();
    const rowsProvinsi = await query<BarisProvinsi>(
        "SELECT k.nama, w.nama provinsi FROM kota k LEFT JOIN wilayah w ON w.id = k.wilayah_id",
    );
    for (const row of rowsProvinsi) {
        provinsiKota.set(String(row.nama ?? "").trim().toLowerCase(), String(row.provinsi ?? ""));
    }

    const perKota: BarisKota[] = [];
    for (const [namaKota, d] of rekapKota) {
        perKota.push({ ...d, kota: namaKota, provinsi: provinsiKota.get(namaKota.toLowerCase()) ?? "" });
    }
    perKota.sort((a, b) => b.jml - a.jml || b.jual - a.jual);

    const totalKota: TotalKota = { jml: 0, jual: 0, trip: 0, unit: 0 };
    for (const k of perKota) {
        totalKota.jml += k.jml;
        totalKota.jual += k.jual;
        totalKota.trip += k.trip;
        totalKota.unit += k.unit;
    }

    const users = new Map<number, BarisUser>();
    for (const u of await query<BarisUser>("SELECT * FROM users")) {
        users.set(Number(u.id), u);
    }

    /* ===== PENJUALAN PER MOBIL / ARMADA (revisi #16) ===== */
    const perMobil: BarisMobil[] = [];
    const rowsMobil = await query<BarisMobilDb>(
        `SELECT i.unit_id, i.nama_unit, i.nopol, COUNT(*) trip,
                COALESCE(SUM(i.jumlah_hari),0) hari,
                COALESCE(SUM(i.subtotal_jual),0) jual,
                COALESCE(SUM(i.subtotal_modal),0) modal
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${syarat}
         GROUP BY i.unit_id, i.nama_unit, i.nopol`,
        param,
    );
    for (const row of rowsMobil) {
        const jual = Number(row.jual);
        const modal = Number(row.modal);
        perMobil.push({
            unit_id: Number(row.unit_id),
            nama_unit: String(row.nama_unit ?? ""),
            nopol: String(row.nopol ?? ""),
            trip: Number(row.trip),
            hari: Number(row.hari),
            jual,
            ...(bolehModal ? { modal, margin: jual - modal } : {}),
        });
    }
    perMobil.sort((a, b) => b.jual - a.jual || b.trip - a.trip);

    const totalMobil: TotalMobil = { trip: 0, hari: 0, jual: 0, modal: 0, margin: 0 };
    for (const x of perMobil) {
        totalMobil.trip += x.trip;
        totalMobil.hari += x.hari;
        totalMobil.jual += x.jual;
        totalMobil.modal = (totalMobil.modal ?? 0) + (x.modal ?? 0);
        totalMobil.margin = (totalMobil.margin ?? 0) + (x.margin ?? 0);
    }
    if (!bolehModal) {
        delete totalMobil.modal;
        delete totalMobil.margin;
    }

    /* ===== TOTAL TRIP DRIVER (revisi #17) ===== */
    const perDriver: BarisDriver[] = [];
    const rowsDriver = await query<BarisDriverDb>(
        `SELECT i.driver_id, i.nama_driver, d.jenjang, COUNT(*) trip,
                COALESCE(SUM(i.jumlah_hari),0) hari,
                COUNT(DISTINCT i.unit_id) unit,
                COALESCE(SUM(i.subtotal_jual),0) jual
         FROM order_items i JOIN orders o ON o.id = i.order_id
         LEFT JOIN drivers d ON d.id = i.driver_id
         WHERE ${syarat}
         GROUP BY i.driver_id, i.nama_driver, d.jenjang`,
        param,
    );
    for (const row of rowsDriver) {
        perDriver.push({
            driver_id: Number(row.driver_id),
            nama_driver: String(row.nama_driver ?? ""),
            jenjang: String(row.jenjang ?? ""),
            trip: Number(row.trip),
            hari: Number(row.hari),
            unit: Number(row.unit),
            jual: Number(row.jual),
        });
    }
    perDriver.sort((a, b) => b.trip - a.trip || b.jual - a.jual);

    const totalDriver: TotalDriver = { trip: 0, hari: 0, unit: 0, jual: 0 };
    for (const x of perDriver) {
        totalDriver.trip += x.trip;
        totalDriver.hari += x.hari;
        totalDriver.unit += x.unit;
        totalDriver.jual += x.jual;
    }

    /* ===== PER JENIS ARMADA (grafik "By ARMADA") — revisi #22 ===== */
    const perJenis: BarisJenis[] = [];
    const rowsJenis = await query<BarisJenisDb>(
        `SELECT COALESCE(NULLIF(u.jenis, ''), 'Lain') jenis, COUNT(*) trip,
                COALESCE(SUM(i.subtotal_jual),0) jual
         FROM order_items i JOIN orders o ON o.id = i.order_id
         LEFT JOIN units u ON u.id = i.unit_id
         WHERE ${syarat}
         GROUP BY COALESCE(NULLIF(u.jenis, ''), 'Lain')`,
        param,
    );
    for (const row of rowsJenis) {
        perJenis.push({ jenis: String(row.jenis ?? ""), trip: Number(row.trip), jual: Number(row.jual) });
    }
    perJenis.sort((a, b) => b.jual - a.jual);

    const baris: BarisReservasi[] = [];
    for (const [uid, d] of rekap) {
        const u = users.get(uid) ?? null;
        const isi = {
            pembuat: u ? String(u.panggilan || u.nama || "") : "Tanpa pembuat",
            username: u?.username ?? "-",
            peran: u ? labelRole(normalisasiRole(u.role)) : "-",
            jml: d.jml,
            jual: d.jual,
            trip: d.trip,
            unit: d.unit,
        };
        baris.push(bolehModal ? { ...isi, modal: d.modal, margin: d.margin } : isi);
    }
    baris.sort((a, b) => b.jual - a.jual);

    const total: TotalReservasi = { jml: 0, jual: 0, trip: 0, unit: 0, modal: 0, margin: 0 };
    for (const b of baris) {
        total.jml += b.jml;
        total.jual += b.jual;
        total.trip += b.trip;
        total.unit += b.unit;
        total.modal = (total.modal ?? 0) + (b.modal ?? 0);
        total.margin = (total.margin ?? 0) + (b.margin ?? 0);
    }
    if (!bolehModal) {
        delete total.modal;
        delete total.margin;
    }

    return {
        mode: p.mode,
        modePilihan: p.modePilihan,
        acuan: p.acuan,
        mulai: p.mulai,
        sampai: p.sampai,
        labelPeriode: tglAngka(p.mulai) + " s/d " + tglAngka(p.sampai),
        baris,
        total,
        perKota,
        totalKota,
        perMobil,
        totalMobil,
        perJenis,
        perDriver,
        totalDriver,
        lihatSemua,
        bolehModal,
    };
}

/* ============================== DETAIL DRIVER ============================== */

export interface Driver {
    id: number;
    nama: string;
    jenjang: string | null;
    wilayah: string | null;
    foto: string | null;
}

export interface BarisTrip {
    order_id: number;
    nomor_order: string;
    tgl_mulai: string;
    tgl_finish: string;
    status: string;
    nama_pesanan: string;
    kota: string | null;
    nama_unit: string | null;
    nopol: string | null;
    jumlah_hari: number;
    subtotal_jual: number;
    harga_jual_per_hari: number;
}

export interface LaporanDriver {
    driver: Driver;
    trip: BarisTrip[];
    totalTrip: number;
    totalHari: number;
    totalJual: number;
    mode: ModePeriode;
    modePilihan: typeof MODE_PILIHAN;
    acuan: string;
    labelPeriode: string;
    lihatSemua: boolean;
}

/** Detail trip per driver (revisi #17). null bila driver tidak ada (pemanggil -> notFound()). */
export async function ambilDriverDetail(
    id: number,
    q: KueriPeriode,
    user: SesiLaporan,
): Promise<LaporanDriver | null> {
    const p = periode(q);

    const driver = await queryOne<Driver>("SELECT * FROM drivers WHERE id = ?", [id]);
    if (!driver) {
        return null;
    }

    const lihatSemua = roleBoleh(user.role, "laporan.semua");

    let syarat = "o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed') AND o.tgl_mulai BETWEEN ? AND ?";
    const param: unknown[] = [p.mulai, p.sampai];
    if (!lihatSemua) {
        syarat += " AND o.created_by = ?";
        param.push(user.id);
    }

    const trip = await query<BarisTrip>(
        `SELECT o.id order_id, o.nomor_order, o.tgl_mulai, o.tgl_finish, o.status, o.nama_pesanan, o.kota,
                i.nama_unit, i.nopol, i.jumlah_hari, i.subtotal_jual, i.harga_jual_per_hari
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${syarat} AND i.driver_id = ?
         ORDER BY o.tgl_mulai DESC, o.id DESC`,
        [...param, id],
    );

    let totalHari = 0;
    let totalJual = 0;
    for (const t of trip) {
        totalHari += Number(t.jumlah_hari);
        totalJual += Number(t.subtotal_jual);
    }

    return {
        driver,
        trip,
        totalTrip: trip.length,
        totalHari,
        totalJual,
        mode: p.mode,
        modePilihan: p.modePilihan,
        acuan: p.acuan,
        labelPeriode: p.labelPeriode,
        lihatSemua,
    };
}

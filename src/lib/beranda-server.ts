import "server-only";
import { query, queryOne } from "@/lib/db";
import { bulanSingkat, sekarangJakarta } from "@/lib/format";

/*
 * Beranda — port PERSIS app/Http/Controllers/BerandaController.php
 * (index + kalenderUnit, yang menyalin pages/beranda.php + includes/kalender_unit.php).
 * HANYA MEMBACA data.
 *
 * Margin SENGAJA tidak dikirim (sama seperti Laravel): owner menilai margin beli-jual
 * menyesatkan sebelum biaya operasional dihitung. Karena itu Beranda tidak butuh
 * penyaringan peran — aturan lihat_modal hanya berlaku di laporan/invoice.
 */

/* ============================== BANTU TANGGAL ============================== */

interface BagianTgl {
    y: number;
    m: number;
    d: number;
}

/** Pecah "YYYY-MM-DD" jadi bagian angka; null bila tidak cocok. */
function bagian(tgl: string | null | undefined): BagianTgl | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(tgl ?? ""));
    if (!m) {
        return null;
    }
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** date('Y-m-d', strtotime("+n days")) — aman dari geser zona waktu. */
function tambahHari(tgl: string, n: number): string {
    const p = bagian(tgl) as BagianTgl;
    return ymd(new Date(Date.UTC(p.y, p.m - 1, p.d + n)));
}

/** date('Y-m-01', strtotime("n month")) — awal bulan setelah digeser n bulan. */
function awalBulan(tgl: string, n = 0): string {
    const p = bagian(tgl) as BagianTgl;
    return ymd(new Date(Date.UTC(p.y, p.m - 1 + n, 1)));
}

/** date('Y-m-t') — hari terakhir bulan dari tanggal itu. */
function akhirBulan(tgl: string): string {
    const p = bagian(tgl) as BagianTgl;
    return ymd(new Date(Date.UTC(p.y, p.m, 0)));
}

const NAMA_HARI_SINGKAT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/* ============================== TIPE HASIL ============================== */

/** Satu baris pesanan yang memakai unit/driver pada rentang kalender. */
export interface BarisPakai {
    id: number;
    nomor_order: string;
    nama_pesanan: string;
    status: string;
    tgl_mulai: string;
    tgl_finish: string;
    created_by: number | null;
    pembuat: string | null;
    unit_id?: number | null;
    nopol?: string | null;
    nama_unit?: string | null;
    nama_driver?: string | null;
    driver_id?: number | null;
}

export interface SelKalender {
    tgl: string;
    hariAngka: number;
    namaHari: string;
    akhirPekan: boolean;
}

export interface UnitManual {
    nopol: string;
    nama_unit: string;
    hari: Record<string, BarisPakai[]>;
}

export interface HasilKalender {
    pilihanHari: Array<[number, string]>;
    jumlahHari: number;
    cari: string;
    tampilSemua: boolean;
    tanggal: SelKalender[];
    jadwal: Record<string, Record<string, BarisPakai[]>>;
    manual: Record<string, UnitManual>;
    unitHariIni: number;
    manualHariIni: number;
    totalUnit: number;
    unitTampil: Array<{ id: number; nama_unit: string; nopol: string }>;
    batasBaris: number;
    jadwalDriver: Record<string, Record<string, BarisPakai[]>>;
    driverTampil: Array<{ id: number; nama: string; jenjang: string | null }>;
    driverHariIni: number;
    totalDriver: number;
}

export interface BarisBeranda {
    id: number;
    nomor_order: string;
    tgl_mulai: string;
    tgl_finish?: string;
    jumlah_hari?: number;
    nama_pesanan: string;
    status: string;
    grand_total: number | string;
    kota?: string | null;
    nama_pic?: string | null;
    nopol: string | null;
    driver?: string | null;
}

export interface TitikGrafik {
    bulan: string;
    kode: string;
    jumlah: number;
    nilai: number;
}

export interface HasilBeranda extends HasilKalender {
    periodePilihan: Record<string, string>;
    periode: string;
    mulai: string;
    sampai: string;
    ringkas: { c: number; j: number; m: number };
    unitPeriode: number;
    nilaiPeriode: { j: number; m: number; c: number };
    berjalan: number;
    unitKeluar: number;
    inv: { c: number; s: number };
    historis: { c: number; t: number };
    papan: Record<string, { c: number; t: number }>;
    tanpaUnit: number;
    grafik: TitikGrafik[];
    pesananPeriode: BarisBeranda[];
    terbaru: BarisBeranda[];
    hariIni: string;
}

/** Parameter query Beranda (semuanya string mentah dari query string). */
export interface ParamsBeranda {
    periode: string;
    dari: string;
    sampai: string;
    hari: string;
    unit: string;
    semua: string;
}

const PILIHAN_PERIODE: Record<string, string> = {
    hari: "Hari ini",
    "7hari": "7 hari",
    bulan: "Bulan ini",
    "3bulan": "3 bulan",
    tahun: "Tahun ini",
    custom: "Rentang sendiri",
};

const TGL_VALID = /^\d{4}-\d{2}-\d{2}$/;

/** Rentang periode ringkasan — port blok switch BerandaController::index. */
function hitungPeriode(periodeAwal: string, dariParam: string, sampaiParam: string, hariIni: string) {
    let periode = PILIHAN_PERIODE[periodeAwal] ? periodeAwal : "bulan";
    let mulai: string;
    let sampai: string;

    switch (periode) {
        case "hari":
            mulai = sampai = hariIni;
            break;
        case "7hari":
            mulai = tambahHari(hariIni, -6);
            sampai = hariIni;
            break;
        case "3bulan":
            mulai = awalBulan(tambahHari(awalBulan(hariIni), -1), -1);
            sampai = akhirBulan(hariIni);
            break;
        case "tahun": {
            const th = (bagian(hariIni) as BagianTgl).y;
            mulai = `${th}-01-01`;
            sampai = `${th}-12-31`;
            break;
        }
        case "custom":
            mulai = TGL_VALID.test(dariParam) ? dariParam : awalBulan(hariIni);
            sampai = TGL_VALID.test(sampaiParam) ? sampaiParam : hariIni;
            if (sampai < mulai) {
                const t = mulai;
                mulai = sampai;
                sampai = t;
            }
            break;
        default:
            periode = "bulan";
            mulai = awalBulan(hariIni);
            sampai = akhirBulan(hariIni);
    }

    return { periode, mulai, sampai };
}

/* ============================== KALENDER ============================== */

/** Papan ketersediaan unit + driver — port BerandaController::kalenderUnit. */
async function kalenderUnit(q: ParamsBeranda, hariIni: string): Promise<HasilKalender> {
    const pilihanHari: Array<[number, string]> = [
        [7, "7 hari"],
        [14, "14 hari"],
        [30, "30 hari"],
    ];
    const hariDiminta = Number(q.hari);
    const jumlahHari = pilihanHari.some(([k]) => k === hariDiminta) ? hariDiminta : 14;

    const cari = (q.unit ?? "").trim();
    const tampilSemua = (q.semua ?? "") === "1";

    const tanggal: SelKalender[] = [];
    for (let i = 0; i < jumlahHari; i++) {
        const t = tambahHari(hariIni, i);
        const p = bagian(t) as BagianTgl;
        const w = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
        tanggal.push({
            tgl: t,
            hariAngka: p.d,
            namaHari: NAMA_HARI_SINGKAT[w] ?? "",
            akhirPekan: w === 0 || w === 6,
        });
    }
    const awal = tanggal[0].tgl;
    const akhir = tanggal[tanggal.length - 1].tgl;

    const pakai = await query<BarisPakai>(
        `SELECT o.id, o.nomor_order, o.nama_pesanan, o.status, o.tgl_mulai, o.tgl_finish, o.created_by,
                u.username AS pembuat, u.panggilan AS pembuat_panggilan,
                i.unit_id, i.nopol, i.nama_unit, i.nama_driver
         FROM order_items i JOIN orders o ON o.id = i.order_id
         LEFT JOIN users u ON u.id = o.created_by
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed','draft')
           AND i.unit_id IS NOT NULL
           AND NOT (o.tgl_finish < ? OR o.tgl_mulai > ?)
         ORDER BY o.tgl_mulai, o.id`,
        [awal, akhir],
    );

    const jadwal: Record<string, Record<string, BarisPakai[]>> = {};
    for (const p of pakai) {
        const uid = String(Number(p.unit_id));
        const t1 = p.tgl_mulai > awal ? p.tgl_mulai : awal;
        const t2 = p.tgl_finish < akhir ? p.tgl_finish : akhir;
        for (let t = t1; t <= t2; t = tambahHari(t, 1)) {
            const perTanggal = (jadwal[uid] ??= {});
            (perTanggal[t] ??= []).push(p);
        }
    }

    /* unit MANUAL (unit_id NULL) */
    const manualPakai = await query<BarisPakai>(
        `SELECT o.id, o.nomor_order, o.nama_pesanan, o.status, o.tgl_mulai, o.tgl_finish, o.created_by,
                u.username AS pembuat, u.panggilan AS pembuat_panggilan,
                i.nama_unit, i.nopol
         FROM order_items i JOIN orders o ON o.id = i.order_id
         LEFT JOIN users u ON u.id = o.created_by
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed','draft')
           AND i.unit_id IS NULL
           AND NOT (o.tgl_finish < ? OR o.tgl_mulai > ?)
         ORDER BY o.tgl_mulai, o.id`,
        [awal, akhir],
    );

    let manual: Record<string, UnitManual> = {};
    for (const p of manualPakai) {
        const nopolMentah = p.nopol === null || p.nopol === undefined ? "" : String(p.nopol).trim();
        const nopol = nopolMentah !== "" && nopolMentah !== "-" ? nopolMentah.toUpperCase() : "";
        const namaUnit = String(p.nama_unit ?? "").trim();
        const kunci = nopol !== "" ? nopol : namaUnit !== "" ? namaUnit : "Unit manual";
        const entri = (manual[kunci] ??= { nopol, nama_unit: namaUnit, hari: {} });
        const t1 = p.tgl_mulai > awal ? p.tgl_mulai : awal;
        const t2 = p.tgl_finish < akhir ? p.tgl_finish : akhir;
        for (let t = t1; t <= t2; t = tambahHari(t, 1)) {
            (entri.hari[t] ??= []).push(p);
        }
    }

    let unitHariIni = 0;
    for (const perTanggal of Object.values(jadwal)) {
        if (perTanggal[hariIni] && perTanggal[hariIni].length > 0) {
            unitHariIni++;
        }
    }
    let manualHariIni = 0;
    for (const m of Object.values(manual)) {
        if (m.hari[hariIni] && m.hari[hariIni].length > 0) {
            manualHariIni++;
        }
    }

    const totalUnit = Number(
        (await queryOne<{ c: number }>("SELECT COUNT(*) c FROM units WHERE deleted_at IS NULL"))?.c ?? 0,
    );

    /* ===== KALENDER DRIVER (revisi #20) ===== */
    const pakaiDriver = await query<BarisPakai>(
        `SELECT o.id, o.nomor_order, o.nama_pesanan, o.status, o.tgl_mulai, o.tgl_finish, o.created_by,
                u.username AS pembuat, u.panggilan AS pembuat_panggilan,
                i.driver_id, i.nama_driver, i.nama_unit, i.nopol
         FROM order_items i JOIN orders o ON o.id = i.order_id
         LEFT JOIN users u ON u.id = o.created_by
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed','draft')
           AND i.driver_id IS NOT NULL
           AND NOT (o.tgl_finish < ? OR o.tgl_mulai > ?)
         ORDER BY o.tgl_mulai, o.id`,
        [awal, akhir],
    );

    const jadwalDriver: Record<string, Record<string, BarisPakai[]>> = {};
    for (const p of pakaiDriver) {
        const did = String(Number(p.driver_id));
        const t1 = p.tgl_mulai > awal ? p.tgl_mulai : awal;
        const t2 = p.tgl_finish < akhir ? p.tgl_finish : akhir;
        for (let t = t1; t <= t2; t = tambahHari(t, 1)) {
            const perTanggal = (jadwalDriver[did] ??= {});
            (perTanggal[t] ??= []).push(p);
        }
    }

    let driverHariIni = 0;
    for (const perTanggal of Object.values(jadwalDriver)) {
        if (perTanggal[hariIni] && perTanggal[hariIni].length > 0) {
            driverHariIni++;
        }
    }

    const totalDriver = Number(
        (await queryOne<{ c: number }>("SELECT COUNT(*) c FROM drivers WHERE deleted_at IS NULL"))?.c ?? 0,
    );

    const driverSemua = await query<{ id: number; nama: string; jenjang: string | null }>(
        "SELECT id, nama, jenjang FROM drivers WHERE deleted_at IS NULL ORDER BY nama",
    );
    const driverTampil = driverSemua.filter(
        (d) => tampilSemua || cari !== "" || Boolean(jadwalDriver[String(Number(d.id))]),
    );

    if (cari !== "") {
        const kunci = cari.toLowerCase();
        manual = Object.fromEntries(
            Object.entries(manual).filter(
                ([, m]) => m.nopol.toLowerCase().includes(kunci) || m.nama_unit.toLowerCase().includes(kunci),
            ),
        );
    }

    const batasBaris = 80;
    let unitTampil: Array<{ id: number; nama_unit: string; nopol: string }> = [];
    if (cari !== "") {
        const like = `%${cari}%`;
        unitTampil = await query(
            `SELECT id, nama_unit, nopol FROM units
             WHERE deleted_at IS NULL
               AND (nopol LIKE ? OR REPLACE(nopol, ' ', '') LIKE ? OR nama_unit LIKE ?)
             ORDER BY nama_unit LIMIT 40`,
            [like, like, like],
        );
    } else if (tampilSemua) {
        unitTampil = await query(
            `SELECT id, nama_unit, nopol FROM units WHERE deleted_at IS NULL
             ORDER BY nama_unit LIMIT ${batasBaris}`,
        );
    } else {
        const idTerpakai = Object.keys(jadwal).map(Number);
        if (idTerpakai.length > 0) {
            unitTampil = await query(
                `SELECT id, nama_unit, nopol FROM units
                 WHERE deleted_at IS NULL AND id IN (?)
                 ORDER BY nama_unit`,
                [idTerpakai],
            );
        }
    }

    return {
        pilihanHari,
        jumlahHari,
        cari,
        tampilSemua,
        tanggal,
        jadwal,
        manual,
        unitHariIni,
        manualHariIni,
        totalUnit,
        unitTampil,
        batasBaris,
        jadwalDriver,
        driverTampil,
        driverHariIni,
        totalDriver,
    };
}

/* ============================== UTAMA ============================== */

/** Kalender ketersediaan saja — dipakai halaman /ketersediaan. */
export async function ambilKalender(q: ParamsBeranda): Promise<HasilKalender> {
    return kalenderUnit(q, sekarangJakarta());
}

/** Semua data Beranda — port BerandaController::index + kalenderUnit. */
export async function ambilBeranda(q: ParamsBeranda): Promise<HasilBeranda> {
    const hariIni = sekarangJakarta();
    const { periode, mulai, sampai } = hitungPeriode(q.periode ?? "", q.dari ?? "", q.sampai ?? "", hariIni);

    /* pesanan historis impor (Lunas tanpa invoice) tidak dihitung pendapatan */
    const syaratHistoris =
        "(NOT (o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM invoices iv WHERE iv.order_id = o.id AND iv.status <> 'batal')))";

    const ringkasRow = await queryOne<{ c: number; j: string; m: string }>(
        `SELECT COUNT(*) c, COALESCE(SUM(o.grand_total),0) j, COALESCE(SUM(o.margin),0) m
         FROM orders o
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
           AND o.tgl_mulai BETWEEN ? AND ?`,
        [mulai, sampai],
    );

    const unitPeriode = Number(
        (
            await queryOne<{ c: number }>(
                `SELECT COUNT(DISTINCT i.unit_id) c FROM order_items i JOIN orders o ON o.id = i.order_id
                 WHERE o.deleted_at IS NULL AND i.unit_id IS NOT NULL
                   AND o.status NOT IN ('cancelled','closed')
                   AND o.tgl_mulai BETWEEN ? AND ?`,
                [mulai, sampai],
            )
        )?.c ?? 0,
    );

    const nilaiPeriodeRow = await queryOne<{ j: string; m: string; c: number }>(
        `SELECT COALESCE(SUM(o.grand_total),0) j, COALESCE(SUM(o.margin),0) m, COUNT(*) c
         FROM orders o
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
           AND ${syaratHistoris}
           AND o.tgl_mulai BETWEEN ? AND ?`,
        [mulai, sampai],
    );

    const berjalan = Number(
        (
            await queryOne<{ c: number }>(
                `SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL
                 AND status NOT IN ('cancelled','closed')
                 AND tgl_mulai <= ? AND tgl_finish >= ?`,
                [hariIni, hariIni],
            )
        )?.c ?? 0,
    );

    const unitKeluar = Number(
        (
            await queryOne<{ c: number }>(
                `SELECT COUNT(DISTINCT i.unit_id) c FROM order_items i JOIN orders o ON o.id = i.order_id
                 WHERE o.deleted_at IS NULL AND i.unit_id IS NOT NULL
                   AND o.status NOT IN ('cancelled','closed')
                   AND o.tgl_mulai <= ? AND o.tgl_finish >= ?`,
                [hariIni, hariIni],
            )
        )?.c ?? 0,
    );

    const invRow = await queryOne<{ c: number; s: string }>(
        `SELECT COUNT(*) c, COALESCE(SUM(i.sisa),0) s FROM invoices i
         JOIN orders o ON o.id = i.order_id
         WHERE i.status IN ('terbit','sebagian')
           AND o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')`,
    );

    const historisRow = await queryOne<{ c: number; t: string }>(
        `SELECT COUNT(*) c, COALESCE(SUM(o.grand_total),0) t FROM orders o
         WHERE o.deleted_at IS NULL AND o.status = 'paid'
           AND NOT EXISTS (SELECT 1 FROM invoices iv WHERE iv.order_id = o.id AND iv.status <> 'batal')`,
    );

    /* papan status (kondisi saat ini) */
    const papan: Record<string, { c: number; t: number }> = {};
    for (const row of await query<{ status: string; c: number; t: string }>(
        `SELECT status, COUNT(*) c, COALESCE(SUM(grand_total),0) t FROM orders
         WHERE deleted_at IS NULL GROUP BY status`,
    )) {
        papan[row.status] = { c: Number(row.c), t: Number(row.t) };
    }

    const tanpaUnit = Number(
        (
            await queryOne<{ c: number }>(
                `SELECT COUNT(*) c FROM orders o WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
                 AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)`,
            )
        )?.c ?? 0,
    );

    /* ===== TREN 6 BULAN ===== */
    const grafik: TitikGrafik[] = [];
    for (let i = 5; i >= 0; i--) {
        const aw = awalBulan(hariIni, -i);
        const ak = akhirBulan(aw);
        const p = bagian(aw) as BagianTgl;
        const row = await queryOne<{ c: number; j: string }>(
            `SELECT COUNT(*) c, COALESCE(SUM(o.grand_total),0) j, COALESCE(SUM(o.margin),0) m
             FROM orders o
             WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
               AND ${syaratHistoris}
               AND o.tgl_mulai BETWEEN ? AND ?`,
            [aw, ak],
        );
        grafik.push({
            bulan: `${bulanSingkat(p.m)} ${String(p.y).slice(-2)}`,
            kode: aw.slice(0, 7),
            jumlah: Number(row?.c ?? 0),
            /* margin sengaja tidak dikirim ke dashboard (lihat catatan atas). */
            nilai: Number(row?.j ?? 0),
        });
    }

    /* ===== DAFTAR PESANAN PERIODE ===== */
    const pesananPeriode = await query<BarisBeranda>(
        `SELECT o.id, o.nomor_order, o.tgl_mulai, o.tgl_finish, o.jumlah_hari, o.nama_pesanan,
                o.status, o.grand_total, o.kota, o.nama_pic,
                (SELECT GROUP_CONCAT(DISTINCT i.nopol SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) nopol,
                (SELECT GROUP_CONCAT(DISTINCT i.nama_driver SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) driver
         FROM orders o
         WHERE o.deleted_at IS NULL AND o.status NOT IN ('cancelled','closed')
           AND o.tgl_mulai BETWEEN ? AND ?
         ORDER BY o.tgl_mulai DESC, o.id DESC LIMIT 12`,
        [mulai, sampai],
    );

    const terbaru = await query<BarisBeranda>(
        `SELECT o.id, o.nomor_order, o.tgl_mulai, o.nama_pesanan, o.status, o.grand_total,
                (SELECT GROUP_CONCAT(DISTINCT i.nopol SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) nopol
         FROM orders o WHERE o.deleted_at IS NULL
         ORDER BY o.created_at DESC, o.id DESC LIMIT 6`,
    );

    const kalender = await kalenderUnit(q, hariIni);

    return {
        periodePilihan: PILIHAN_PERIODE,
        periode,
        mulai,
        sampai,
        ringkas: {
            c: Number(ringkasRow?.c ?? 0),
            j: Number(ringkasRow?.j ?? 0),
            m: Number(ringkasRow?.m ?? 0),
        },
        unitPeriode,
        nilaiPeriode: {
            j: Number(nilaiPeriodeRow?.j ?? 0),
            m: Number(nilaiPeriodeRow?.m ?? 0),
            c: Number(nilaiPeriodeRow?.c ?? 0),
        },
        berjalan,
        unitKeluar,
        inv: { c: Number(invRow?.c ?? 0), s: Number(invRow?.s ?? 0) },
        historis: { c: Number(historisRow?.c ?? 0), t: Number(historisRow?.t ?? 0) },
        papan,
        tanpaUnit,
        grafik,
        pesananPeriode,
        terbaru,
        hariIni,
        ...kalender,
    };
}

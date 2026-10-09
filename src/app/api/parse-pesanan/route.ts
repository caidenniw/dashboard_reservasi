import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { bolehLihatModal, labelRole, roleBoleh } from "@/lib/akses";
import { query, queryOne } from "@/lib/db";
import { parseTeksPesanan, pnTanggal, type ItemTeks } from "@/lib/parse-teks";
import { asistenParseJson, bolehJalan, cekToken, siap } from "@/lib/asisten-server";

/*
 * POST /api/parse-pesanan — "Bedah teks pesanan" (JSON).
 * Port PERSIS ParsePesananController::__invoke.
 *
 * Alur:
 *   1. Parser deterministik membaca teks template.
 *   2. Kalau hasilnya lemah (keyakinan < 60 atau tanggal/nama pesanan kosong),
 *      barulah dicoba fallback AI untuk MENAMBAL field yang belum terbaca.
 *   3. Hasil dilengkapi pencocokan ke data master (unit/driver/customer/include):
 *      harga modal & jual diambil dari master unit bila ada.
 *
 * Endpoint ini TIDAK menyimpan apa pun. Penyimpanan tetap lewat form pesanan
 * yang direview pengguna.
 *
 * Token khusus endpoint ini STABIL per user (HMAC, lihat tokenUntuk di
 * asisten-server) — berbeda dari token CSRF form. Tombol "Bedah & Isi Otomatis"
 * boleh diklik berkali-kali tanpa memuat ulang halaman.
 */

function jawab(data: Record<string, unknown>, status = 200): NextResponse {
    return NextResponse.json(data, { status });
}

/** Balasan item yang dilengkapi ID master + harga per hari (port langkah 3). */
interface ItemKeluar extends ItemTeks {
    unit_id: number;
    driver_id: number;
    harga_modal_per_hari: number;
    dari_master: { unit: boolean; driver: boolean };
    jumlah_hari: number;
}

export async function GET(): Promise<NextResponse> {
    return jawab({ ok: false, error: "Metode tidak diizinkan." }, 405);
}

export async function POST(req: Request): Promise<NextResponse> {
    /* login sudah dijaga proxy; cek ulang supaya 401 sama seperti sistem lama */
    const user = await userSekarang();
    if (!user) {
        return jawab({ ok: false, error: "Sesi berakhir. Silakan masuk ulang." }, 401);
    }
    /* Sama seperti middleware akses:pesanan.tulis di Laravel (redirect ke beranda
       + flash "Halaman itu tidak tersedia untuk peran ..."). Di sini tanpa redirect:
       kode 403 dengan pesan yang sama, karena pemanggilnya fetch. */
    if (!roleBoleh(user.role, "pesanan.tulis")) {
        return jawab(
            { ok: false, error: `Halaman itu tidak tersedia untuk peran ${labelRole(user.role)}.` },
            403,
        );
    }

    const form = await req.formData();
    const token = String(form.get("token") ?? "");
    if (token === "" || !cekToken(user.id, token)) {
        return jawab({ ok: false, error: "Token keamanan tidak valid. Muat ulang halaman." }, 419);
    }

    const teks = String(form.get("teks") ?? "").trim();
    if (teks === "") {
        return jawab({ ok: false, error: "Teks pesanan masih kosong." }, 422);
    }
    if ([...teks].length > 8000) {
        return jawab({ ok: false, error: "Teks terlalu panjang (maksimal 8.000 karakter)." }, 422);
    }

    /* Pembatas sederhana: maksimal 30 bedah per 10 menit per user. */
    if (!bolehJalan(`parse:${user.id}`, 30, 600)) {
        return jawab(
            { ok: false, error: "Batas 30 bedah per 10 menit tercapai. Coba lagi beberapa saat lagi." },
            429,
        );
    }

    /* ===================== 1. PARSER DETERMINISTIK ===================== */
    const hasil = parseTeksPesanan(teks);
    let sumber = "parser";

    /* ===================== 2. FALLBACK AI (hanya bila perlu) ===================== */
    const lemah = hasil.yakin < 60 || hasil.data.tgl_mulai === "" || hasil.data.nama_pesanan === "";
    if (lemah && siap()) {
        const ai = await asistenParseJson(teks);
        if (ai.ok && ai.json !== null && typeof ai.json === "object" && !Array.isArray(ai.json)) {
            const j = ai.json as Record<string, unknown>;
            sumber = "parser+ai";
            const tempel = (
                k: "wilayah_pelayanan" | "kota" | "jam" | "standby_point" | "flight" | "nama_pesanan" | "nama_pic" | "hp_pic",
            ) => {
                if (hasil.data[k] === "" && j[k]) {
                    hasil.data[k] = String(j[k]);
                }
            };
            (["wilayah_pelayanan", "kota", "jam", "standby_point", "flight", "nama_pesanan", "nama_pic", "hp_pic"] as const).forEach(tempel);
            for (const k of ["tgl_mulai", "tgl_finish"] as const) {
                if (hasil.data[k] === "" && j[k]) {
                    const t = pnTanggal(String(j[k]));
                    if (t !== "") {
                        hasil.data[k] = t;
                    }
                }
            }
            if (hasil.data.wilayah_pelayanan === "dalam_kota" && j["wilayah_pelayanan"] === "luar_kota") {
                hasil.data.wilayah_pelayanan = "luar_kota";
            }
            if (hasil.data.jumlah_hari <= 0 && j["jumlah_hari"]) {
                hasil.data.jumlah_hari = Number(j["jumlah_hari"]);
            }
            if (Number(hasil.data.jam_koordinasi) === 0 && j["jam_koordinasi"]) {
                hasil.data.jam_koordinasi = 1;
            }
            if (hasil.items.length === 0 && Array.isArray(j["items"])) {
                for (const itRaw of j["items"] as unknown[]) {
                    const it = itRaw as Record<string, unknown>;
                    hasil.items.push({
                        nama_driver: String(it["nama_driver"] ?? ""),
                        hp_driver: String(it["hp_driver"] ?? ""),
                        nama_unit: String(it["nama_unit"] ?? ""),
                        nopol: String(it["nopol"] ?? "").toUpperCase(),
                        harga_jual_per_hari: Number(String(it["harga_jual_per_hari"] ?? "").replace(/[^0-9]/g, "")) || 0,
                    });
                }
            }
            if (hasil.includes.length === 0 && Array.isArray(j["includes"])) {
                hasil.includes = (j["includes"] as unknown[]).map((x) => String(x).trim()).filter((x) => x !== "");
            }
            if (hasil.biaya.length === 0 && Array.isArray(j["biaya"])) {
                for (const bRaw of j["biaya"] as unknown[]) {
                    const b = bRaw as Record<string, unknown>;
                    hasil.biaya.push({
                        nama: String(b["nama"] ?? ""),
                        nominal: Number(String(b["nominal"] ?? "").replace(/[^0-9]/g, "")) || 0,
                    });
                }
            }
            if (hasil.total_teks === 0 && j["total_teks"]) {
                hasil.total_teks = Number(String(j["total_teks"]).replace(/[^0-9]/g, "")) || 0;
            }
            hasil.catatan.push("Beberapa bagian dibaca dengan bantuan AI — mohon diperiksa.");
        } else if (siap()) {
            hasil.catatan.push("AI pembaca teks sedang tidak bisa dipakai; hasil sepenuhnya dari pembaca pola.");
        }
    }

    /* jumlah hari susulan bila baru terisi dari AI */
    if (hasil.data.jumlah_hari <= 0 && hasil.data.tgl_mulai !== "" && hasil.data.tgl_finish !== "") {
        const selisih =
            (Date.parse(`${hasil.data.tgl_finish}T00:00:00Z`) - Date.parse(`${hasil.data.tgl_mulai}T00:00:00Z`)) /
                86400000 +
            1;
        hasil.data.jumlah_hari = Math.max(1, Math.round(selisih));
    }

    /* ===================== 3. PELENGKAP DATA MASTER ===================== */
    const hari = Math.max(1, Number(hasil.data.jumlah_hari));
    const itemsKeluar: ItemKeluar[] = [];

    for (const it of hasil.items) {
        const keluar: ItemKeluar = {
            ...it,
            unit_id: 0,
            driver_id: 0,
            /* modal: dari teks hanya dipakai bila peran ini berhak melihat modal (owner/finance).
               Peran reservasi selalu 0 / dari master — tidak boleh mengarang modal. */
            harga_modal_per_hari: bolehLihatModal(user.role)
                ? Math.max(0, Number(it.harga_modal_per_hari ?? 0))
                : 0,
            dari_master: { unit: false, driver: false },
            jumlah_hari: hari,
        };

        /* unit: cocokkan nopol (abaikan spasi & besar-kecil huruf) */
        const nopol = String(it.nopol ?? "").replace(/\s+/g, "");
        if (nopol !== "") {
            const u = await queryOne<{
                id: number;
                nama_unit: string;
                nopol: string;
                harga_modal_default: number | string;
                harga_jual_default: number | string;
            }>(
                `SELECT id, nama_unit, nopol, harga_modal_default, harga_jual_default FROM units
                 WHERE deleted_at IS NULL AND REPLACE(UPPER(nopol), ' ', '') = UPPER(?)`,
                [nopol],
            );
            if (u) {
                keluar.unit_id = Number(u.id);
                keluar.dari_master.unit = true;
                if (keluar.nama_unit === "") {
                    keluar.nama_unit = String(u.nama_unit ?? "");
                }
                if (Number(keluar.harga_modal_per_hari) <= 0) {
                    keluar.harga_modal_per_hari = Number(u.harga_modal_default ?? 0);
                }
                if (Number(keluar.harga_jual_per_hari) <= 0) {
                    keluar.harga_jual_per_hari = Number(u.harga_jual_default ?? 0);
                }
            }
        }

        /* driver: cocokkan nama (abaikan besar-kecil huruf) */
        const nama = String(it.nama_driver ?? "").trim();
        if (nama !== "") {
            const d = await queryOne<{ id: number; nama: string; hp: string | null }>(
                "SELECT id, nama, hp FROM drivers WHERE deleted_at IS NULL AND LOWER(nama) = LOWER(?)",
                [nama],
            );
            if (d) {
                keluar.driver_id = Number(d.id);
                keluar.dari_master.driver = true;
                keluar.nama_driver = String(d.nama ?? "");
                if (keluar.hp_driver === "") {
                    keluar.hp_driver = String(d.hp ?? "");
                }
            }
        }
        itemsKeluar.push(keluar);
    }

    /* customer: kalau nama pesanan sudah ada di master, ambil tipe & sumber-nya */
    let tipe = "retail";
    let sumOrder = "wa";
    let customerAda = false;
    if (hasil.data.nama_pesanan !== "" && hasil.data.nama_pesanan !== "-") {
        const c = await queryOne<{ id: number; tipe: string; sumber: string | null }>(
            "SELECT id, tipe, sumber FROM customers WHERE deleted_at IS NULL AND LOWER(nama_pesanan) = LOWER(?)",
            [hasil.data.nama_pesanan],
        );
        if (c) {
            customerAda = true;
            const tc = String(c.tipe ?? "");
            tipe = ["perorangan", "perusahaan", "instansi", "RO"].includes(tc) ? tc : "retail";
            sumOrder = String(c.sumber ?? "") || "wa";
        }
    }

    /* include: cocokkan nama ke master — PERSIS dulu, lalu cocok sebagian
       (mis. "Tol" -> "Toll & parkir", "BBM" -> "BBM (full)", "Driver" -> "Driver (all-in)") */
    const incMaster = await query<{ id: number; nama: string }>(
        "SELECT id, nama FROM includes ORDER BY urutan, nama",
    );
    const includesOut: Array<{ id: number; nama: string }> = [];
    const incTakKenal: string[] = [];
    for (const namaInc of hasil.includes) {
        const kunci = String(namaInc ?? "").toLowerCase().trim();
        let cocok = incMaster.find((m) => String(m.nama ?? "").toLowerCase() === kunci) ?? null;
        if (!cocok && kunci !== "") {
            for (const m of incMaster) {
                const mn = String(m.nama ?? "").toLowerCase();
                const inti = mn.replace(/\(.*?\)/, "").trim();
                if (mn.includes(kunci) || (inti !== "" && kunci.includes(inti))) {
                    cocok = m;
                    break;
                }
            }
        }
        if (cocok) {
            includesOut.push({ id: Number(cocok.id), nama: String(cocok.nama) });
        } else {
            incTakKenal.push(namaInc);
        }
    }
    if (incTakKenal.length > 0) {
        hasil.catatan.push(`Include tidak ada di master: ${incTakKenal.join(", ")} (bisa dicatat di kolom catatan).`);
    }

    /* ===================== 4. BALASAN ===================== */
    return jawab({
        ok: true,
        sumber,
        yakin: Number(hasil.yakin),
        data: hasil.data,
        items: itemsKeluar,
        includes: includesOut,
        biaya: hasil.biaya,
        total_teks: Number(hasil.total_teks),
        tidak_dikenali: hasil.tidak_dikenali,
        catatan: hasil.catatan,
        /* saran nilai "tidak ada di teks" */
        saran: {
            tipe_pelanggan: tipe,
            sumber: sumOrder,
            customer_baru: !customerAda,
        },
    });
}

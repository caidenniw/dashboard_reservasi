import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { query, queryOne } from "@/lib/db";
import { angka, normalisasiHp } from "@/lib/format";
import type { CfgMaster, KolomMaster } from "@/config/master";

/*
 * Logika CRUD master generik — port 1:1 dari app/Http/Controllers/MasterController.php
 * (yang sendiri meniru includes/master_crud.php sistem lama). Termasuk rapikanNilai
 * dan penyaringan kolom modal berdasarkan peran.
 */

export interface TipeKolomInfo {
    tipe: string;
    nullable: boolean;
}

const cacheTipe = new Map<string, Record<string, TipeKolomInfo>>();

/** Tipe & boleh-kosong kolom database per tabel (diambil sekali per proses). */
export async function tipeKolom(tabel: string): Promise<Record<string, TipeKolomInfo>> {
    const ada = cacheTipe.get(tabel);
    if (ada) {
        return ada;
    }
    const rows = await query<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tabel],
    );
    const out: Record<string, TipeKolomInfo> = {};
    for (const r of rows) {
        out[String(r.COLUMN_NAME).toLowerCase()] = {
            tipe: String(r.DATA_TYPE).toLowerCase(),
            nullable: String(r.IS_NULLABLE).toUpperCase() === "YES",
        };
    }
    cacheTipe.set(tabel, out);
    return out;
}

/**
 * Isian kosong dirapikan sesuai jenis kolomnya, supaya perilakunya sama dengan
 * sistem lama (mysqli) yang membiarkan MySQL mengubah '' sendiri:
 *   - kolom angka  -> NULL bila boleh kosong, 0 bila tidak
 *   - enum/date    -> NULL bila boleh kosong; bila tidak, kolomnya tidak dikirim
 *   - teks         -> tetap ''
 */
export async function rapikanNilai(
    tabel: string,
    data: Record<string, string | number | null>,
): Promise<Record<string, string | number | null>> {
    const tipeAngka = ["int", "bigint", "smallint", "tinyint", "mediumint", "decimal", "float", "double"];
    const tipeKhusus = ["enum", "set", "date", "datetime", "time", "timestamp", "year"];
    const peta = await tipeKolom(tabel);

    const out = { ...data };
    for (const kolom of Object.keys(out)) {
        if (out[kolom] !== "") {
            continue;
        }
        const info = peta[kolom.toLowerCase()];
        if (!info) {
            continue;
        }
        if (tipeAngka.includes(info.tipe)) {
            out[kolom] = info.nullable ? null : 0;
            continue;
        }
        if (tipeKhusus.includes(info.tipe)) {
            if (info.nullable) {
                out[kolom] = null;
            } else {
                delete out[kolom];
            }
        }
    }
    return out;
}

/** Opsi pilihan untuk sebuah kolom, sebagai PASANGAN BERURUTAN [nilai, label].
 *  Sengaja array (bukan objek): JavaScript mengurutkan ulang key berupa angka ke
 *  depan, sehingga urutan & nilai default bisa berbeda dari PHP. */
export type Opsi = Array<[string, string]>;

export async function opsiKolom(c: KolomMaster): Promise<Opsi> {
    if (c.opsi) {
        return Object.entries(c.opsi);
    }
    if (c.opsi_sql) {
        const q = c.opsi_sql;
        const sql = `SELECT ${q.value} AS v, ${q.label} AS l FROM ${q.from} ORDER BY ${q.order ?? q.label}`;
        const rows = await query<{ v: string | number; l: string }>(sql);
        const out: Opsi = [["", "-- pilih --"]];
        for (const r of rows) {
            out.push([String(r.v), String(r.l)]);
        }
        return out;
    }
    return [];
}

/** Ambil semua opsi untuk setiap kolom config (paralel). */
export async function opsiSemua(cfg: CfgMaster): Promise<Record<string, Opsi>> {
    const hasil = await Promise.all(cfg.kolom.map((c) => opsiKolom(c)));
    const out: Record<string, Opsi> = {};
    cfg.kolom.forEach((c, i) => {
        out[c.name] = hasil[i];
    });
    return out;
}

/** Daftar baris master dengan pencarian & pengurutan. */
export async function daftarMaster(
    cfg: CfgMaster,
    cari: string,
): Promise<Array<Record<string, unknown>>> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (cfg.soft_delete) {
        where.push("deleted_at IS NULL");
    }
    if (cari !== "" && cfg.cari_kolom && cfg.cari_kolom.length > 0) {
        const bagian = cfg.cari_kolom.map((k) => `\`${k}\` LIKE ?`);
        where.push("(" + bagian.join(" OR ") + ")");
        params.push(...cfg.cari_kolom.map(() => `%${cari}%`));
    }

    const sql =
        `SELECT * FROM \`${cfg.tabel}\`` +
        (where.length ? " WHERE " + where.join(" AND ") : "") +
        ` ORDER BY ${cfg.order ?? "id DESC"}`;

    return query<Record<string, unknown>>(sql, params);
}

/** Ambil satu baris untuk mode ubah. */
export async function ambilMaster(cfg: CfgMaster, id: number): Promise<Record<string, unknown> | null> {
    if (id <= 0) {
        return null;
    }
    return queryOne<Record<string, unknown>>(`SELECT * FROM \`${cfg.tabel}\` WHERE id = ? LIMIT 1`, [id]);
}

/** Nilai awal tiap kolom form: dari data ubah, isian lama (gagal simpan), lalu default. */
export function nilaiForm(
    cfg: CfgMaster,
    editRow: Record<string, unknown> | null,
    old: Record<string, string[]>,
    semuaOpsi: Record<string, Opsi>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of cfg.kolom) {
        const dariEdit = editRow ? editRow[c.name] : undefined;
        const dariOld = old[c.name]?.[0];
        let v: string;
        if (dariEdit !== undefined && dariEdit !== null) {
            v = String(dariEdit);
        } else if (dariOld !== undefined) {
            v = String(dariOld);
        } else if (c.tipe === "select") {
            /* array_key_first(opsi) — pasangan pertama (mis. "" -> "-- pilih --"). */
            const opsi = semuaOpsi[c.name] ?? [];
            v = opsi.length > 0 ? opsi[0][0] : "";
        } else {
            v = "";
        }
        out[c.name] = v;
    }
    return out;
}

/** Buang kolom modal dari config bila peran tidak boleh melihatnya. */
export function saringKolomModal(cfg: CfgMaster, bolehLihatModal: boolean): CfgMaster {
    if (bolehLihatModal) {
        return cfg;
    }
    return {
        ...cfg,
        kolom: cfg.kolom.filter((c) => c.name !== "harga_modal_default"),
        kolom_list: cfg.kolom_list.filter((n) => n !== "harga_modal_default"),
    };
}

/* ---------------------------------- tulis ---------------------------------- */

export interface HasilSimpan {
    errors: string[];
    pesan?: string;
}

/**
 * Simpan (tambah/ubah) satu baris master. Menangani validasi, konversi angka,
 * normalisasi HP, dan unggah foto — semuanya sama seperti MasterController::simpan.
 */
export async function simpanMaster(
    cfg: CfgMaster,
    form: FormData,
): Promise<HasilSimpan> {
    const id = Number(form.get("id") ?? 0) || 0;
    const errors: string[] = [];
    const data: Record<string, string | number | null> = {};

    for (const c of cfg.kolom) {
        const raw = String(form.get(c.name) ?? "");

        if (c.tipe === "foto") {
            data[c.name] = await tanganiFoto(cfg, c, form, id, errors);
            continue;
        }

        if (c.tipe === "number" || c.tipe === "rupiah") {
            const v = angka(raw);
            if (c.wajib && raw.trim() === "") {
                errors.push(`${c.label} wajib diisi.`);
            }
            data[c.name] = v;
            continue;
        }

        let v = raw.trim();
        if (c.tipe === "tel" && v !== "") {
            v = normalisasiHp(v);
        }
        if (c.wajib && v === "") {
            errors.push(`${c.label} wajib diisi.`);
        }
        if (c.max && v.length > c.max) {
            errors.push(`${c.label} maksimal ${c.max} karakter.`);
        }
        data[c.name] = v;
    }

    if (errors.length > 0) {
        return { errors };
    }

    const bersih = await rapikanNilai(cfg.tabel, data);
    const kolom = Object.keys(bersih);
    const nilai = kolom.map((k) => bersih[k]);

    try {
        if (id > 0) {
            const set = kolom.map((k) => `\`${k}\` = ?`).join(", ");
            await query(`UPDATE \`${cfg.tabel}\` SET ${set} WHERE id = ?`, [...nilai, id]);
            return { errors: [], pesan: "Data berhasil diperbarui." };
        }
        const tanda = kolom.map(() => "?").join(", ");
        await query(
            `INSERT INTO \`${cfg.tabel}\` (${kolom.map((k) => `\`${k}\``).join(", ")}) VALUES (${tanda})`,
            nilai,
        );
        return { errors: [], pesan: "Data berhasil disimpan." };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
            errors: [
                msg.includes("Duplicate")
                    ? "Gagal menyimpan: data dengan kode/nomor yang sama sudah ada."
                    : `Gagal menyimpan: ${msg}`,
            ],
        };
    }
}

/** Hapus: nonaktifkan (soft delete) atau hapus permanen, sama seperti controller lama. */
export async function hapusMaster(cfg: CfgMaster, id: number): Promise<string> {
    if (id <= 0) {
        return "Data tidak ditemukan.";
    }
    if (cfg.soft_delete) {
        await query(`UPDATE \`${cfg.tabel}\` SET deleted_at = NOW() WHERE id = ?`, [id]);
        if (cfg.tabel === "units") {
            /* unik nopol: beri suffix agar nopol sama bisa dipakai unit baru,
               data lama (dan snapshot di order) tidak berubah */
            await query("UPDATE units SET nopol = CONCAT(nopol, '#del', id) WHERE id = ?", [id]);
        }
        return "Data dinonaktifkan (data lama tetap tersimpan).";
    }
    await query(`DELETE FROM \`${cfg.tabel}\` WHERE id = ?`, [id]);
    return "Data dihapus.";
}

/* ---------------------------------- foto ---------------------------------- */

const IZIN_EKST = ["jpg", "jpeg", "png", "webp"];
const MAKS_FOTO = 2 * 1024 * 1024;

/** Validasi gambar dari magic bytes (pengganti getimagesize()). */
function gambarSah(buf: Buffer): boolean {
    if (buf.length < 12) {
        return false;
    }
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return true;
    }
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return true;
    }
    // WEBP: "RIFF" .... "WEBP"
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
        return true;
    }
    return false;
}

async function tanganiFoto(
    cfg: CfgMaster,
    c: KolomMaster,
    form: FormData,
    id: number,
    errors: string[],
): Promise<string> {
    const berkas = form.get(c.name);
    const adaBerkas = berkas instanceof File && berkas.size > 0;

    if (adaBerkas) {
        const f = berkas as File;
        const buf = Buffer.from(await f.arrayBuffer());
        if (!gambarSah(buf)) {
            errors.push(`${c.label} harus berupa gambar (JPG/PNG).`);
            return "";
        }
        if (f.size > MAKS_FOTO) {
            errors.push(`${c.label} maksimal 2 MB.`);
            return "";
        }
        const extAsli = (f.name.split(".").pop() ?? "").toLowerCase();
        const ext = IZIN_EKST.includes(extAsli) ? extAsli : "jpg";
        const folder = path.join(process.cwd(), "public", "uploads", cfg.tabel);
        await fs.mkdir(folder, { recursive: true });
        const namaBerkas = `${stempelWaktu()}_${hexAcak(4)}.${ext}`;
        await fs.writeFile(path.join(folder, namaBerkas), buf);
        return `uploads/${cfg.tabel}/${namaBerkas}`;
    }

    /* Tidak ada berkas baru: pertahankan foto lama, kecuali dicentang "hapus foto". */
    const lama =
        id > 0
            ? String(
                (await queryOne<Record<string, unknown>>(
                    `SELECT \`${c.name}\` AS v FROM \`${cfg.tabel}\` WHERE id = ? LIMIT 1`,
                    [id],
                ))?.v ?? "",
            )
            : "";
    return form.get(`hapus_${c.name}`) ? "" : lama;
}

function stempelWaktu(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function hexAcak(byte: number): string {
    const arr = new Uint8Array(byte);
    crypto.getRandomValues(arr);
    return Buffer.from(arr).toString("hex");
}

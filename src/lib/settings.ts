import "server-only";
import { cache } from "react";
import { query } from "@/lib/db";

/*
 * Pengaturan aplikasi (tabel `settings`) — port semuaSetting()/getSetting()/simpanSetting()
 * dari app/Support/app_lib.php. `key` dan `value` adalah kata kunci MySQL, jadi dibungkus backtick.
 *
 * Dimuat SEKALI per permintaan lewat cache() React (meniru userPermintaan di lib/sesi.ts):
 * getSetting() dulu = 1 query per panggilan, teksWaOrder menembak 6 query berurutan.
 * Tabel settings kecil, jadi sekali baca semua lalu baca lokal. simpanSetting() menaikkan
 * `generasi` supaya permintaan yang sama membaca ulang setelah menulis (cache() tak punya
 * API hapus per kunci; generasi jadi argumen memo, jadi tulis = miss).
 */
let generasi = 0;

/* Argumen = kunci memo cache(); nilai tak dibaca di badan, sengaja — lihat komentar atas. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const muatSemuaSetting = cache(async (_gen: number): Promise<Record<string, string>> => {
    const rows = await query<{ key: string; value: string | null }>(
        "SELECT `key`, `value` FROM settings",
    );
    const out: Record<string, string> = {};
    for (const r of rows) {
        out[r.key] = r.value ?? "";
    }
    return out;
});

export async function semuaSetting(): Promise<Record<string, string>> {
    return muatSemuaSetting(generasi);
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
    const isi = await semuaSetting();
    return isi[key] || fallback;
}

export async function simpanSetting(key: string, value: string): Promise<void> {
    await query(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [key, value],
    );
    generasi += 1;
}

/** Template balasan cepat WA (settings `wa_balasan`, value = JSON array [{label,teks}]). */
export async function daftarTemplatePesan(): Promise<Array<{ label: string; teks: string }>> {
    const mentah = await getSetting("wa_balasan", "");
    if (mentah.trim() === "") {
        return [];
    }
    try {
        const data: unknown = JSON.parse(mentah);
        if (!Array.isArray(data)) {
            return [];
        }
        const out: Array<{ label: string; teks: string }> = [];
        for (const x of data) {
            if (
                x && typeof x === "object" &&
                "label" in x && "teks" in x &&
                typeof x.label === "string" && typeof x.teks === "string"
            ) {
                out.push({ label: x.label, teks: x.teks });
            }
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * Baris lengkap settings (termasuk label, grup, urutan) — untuk halaman Pengaturan.
 */
export interface BarisSetting {
    key: string;
    value: string;
    label: string;
    grup: string;
    urutan: number;
}

export async function daftarSetting(): Promise<BarisSetting[]> {
    return query<BarisSetting>(
        "SELECT `key`, `value`, `label`, `grup`, `urutan` FROM settings ORDER BY `grup`, `urutan`",
    );
}

import "server-only";
import { query } from "@/lib/db";

/*
 * Pengaturan aplikasi (tabel `settings`) — port semuaSetting()/getSetting()/simpanSetting()
 * dari app/Support/app_lib.php. `key` dan `value` adalah kata kunci MySQL, jadi dibungkus backtick.
 */

export async function semuaSetting(): Promise<Record<string, string>> {
    const rows = await query<{ key: string; value: string | null }>(
        "SELECT `key`, `value` FROM settings",
    );
    const out: Record<string, string> = {};
    for (const r of rows) {
        out[r.key] = r.value ?? "";
    }
    return out;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
    const rows = await query<{ value: string | null }>(
        "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
        [key],
    );
    const v = rows.length > 0 ? (rows[0].value ?? "") : "";
    return v !== "" ? v : fallback;
}

/** Ambil beberapa setting sekaligus (mengurangi jumlah query). */
export async function getSettingBanyak(): Promise<Record<string, string>> {
    return semuaSetting();
}

export async function simpanSetting(key: string, value: string): Promise<void> {
    await query(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [key, value],
    );
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
        return data.filter(
            (x): x is { label: string; teks: string } =>
                !!x && typeof x === "object" &&
                typeof (x as { label?: unknown }).label === "string" &&
                typeof (x as { teks?: unknown }).teks === "string",
        );
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

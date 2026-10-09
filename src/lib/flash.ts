/*
 * Flash message — pengganti session()->with('success'|'error'|...).
 *
 * Disimpan sebagai cookie bertanda tangan HMAC-SHA256 (Web Crypto, jadi jalan
 * di Edge runtime middleware maupun Node runtime Server Action).
 *
 * PENTING: `error_validasi` DIPISAH dari `error`.
 * - `error_validasi` = daftar pesan validasi (array) -> dirender <ul class="alert-daftar">
 * - `error`          = pesan tunggal (string)      -> dirender alert biasa
 * Mencampur keduanya pernah menyebabkan 500 di aplikasi lama (array dicetak sebagai teks).
 */

export interface FlashData {
    success?: string;
    error?: string;
    warning?: string;
    info?: string;
    error_validasi?: string[];
    /** Isian lama saat validasi gagal (pengganti withInput()/old()).
     *  Nilai selalu array supaya field berulang (mis. item_unit_id[]) ikut tersimpan. */
    old?: Record<string, string[]>;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array | ArrayBuffer): string {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = "";
    for (const x of b) {
        s += String.fromCharCode(x);
    }
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64url(s: string): Uint8Array<ArrayBuffer> {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

async function kunciHmac(): Promise<CryptoKey> {
    const secret = process.env.APP_KEY ?? process.env.SESSION_SECRET ?? "";
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret || "kunci-flash-belum-disetel"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

export async function tandaiFlash(data: FlashData): Promise<string> {
    const payload = base64url(encoder.encode(JSON.stringify(data)));
    const sig = await crypto.subtle.sign("HMAC", await kunciHmac(), encoder.encode(payload));
    return `${payload}.${base64url(sig)}`;
}

export async function bukaFlash(token: string | undefined | null): Promise<FlashData | null> {
    if (!token) {
        return null;
    }
    const [payload, sig] = token.split(".");
    if (!payload || !sig) {
        return null;
    }
    try {
        const sah = await crypto.subtle.verify(
            "HMAC",
            await kunciHmac(),
            dariBase64url(sig),
            encoder.encode(payload),
        );
        if (!sah) {
            return null;
        }
        return JSON.parse(new TextDecoder().decode(dariBase64url(payload))) as FlashData;
    } catch {
        return null;
    }
}

export const NAMA_COOKIE_FLASH = "rn_flash";

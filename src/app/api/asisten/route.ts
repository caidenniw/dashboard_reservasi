import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { labelRole, normalisasiRole, roleBoleh } from "@/lib/akses";
import type { Role } from "@/lib/akses";
import { bolehJalan, cekToken, siap, tanya } from "@/lib/asisten-server";

/*
 * POST /api/asisten — Tanya asisten data (JSON). HANYA MEMBACA data.
 * Kontrak request/response mengikuti public/assets/js/asisten.js:
 * FormData { token, tanya, riwayat(JSON string) } -> { ok, jawaban, model, sumber, detik }
 */

const MAKS_TANYA = 600;
const MAKS_BEDAH_SESI = 40;
const JENDELA_SESI_DETIK = 600;

function jawab(data: Record<string, unknown>, status = 200): NextResponse {
    return NextResponse.json(data, { status });
}

export async function GET(): Promise<NextResponse> {
    return jawab({ ok: false, error: "Metode tidak diizinkan." }, 405);
}

export async function POST(req: Request): Promise<NextResponse> {
    const user = await userSekarang();
    if (!user) {
        return jawab({ ok: false, error: "Sesi berakhir. Silakan masuk ulang." }, 401);
    }
    /* Sama seperti middleware akses:asisten di Laravel (redirect ke beranda +
       flash "Halaman itu tidak tersedia untuk peran ..."). Di sini tanpa redirect:
       kode 403 dengan pesan yang sama, karena pemanggilnya fetch. */
    if (!roleBoleh(user.role, "asisten")) {
        return jawab({ ok: false, error: `Halaman itu tidak tersedia untuk peran ${labelRole(user.role)}.` }, 403);
    }

    const form = await req.formData();
    const token = String(form.get("token") ?? "");
    if (token === "" || !cekToken(user.id, token)) {
        return jawab({ ok: false, error: "Token keamanan tidak valid. Muat ulang halaman." }, 419);
    }

    const tanyaTeks = String(form.get("tanya") ?? "").trim();
    if (tanyaTeks === "") {
        return jawab({ ok: false, error: "Pertanyaan masih kosong." }, 422);
    }
    if ([...tanyaTeks].length > MAKS_TANYA) {
        return jawab({ ok: false, error: `Pertanyaan terlalu panjang (maksimal ${MAKS_TANYA} karakter).` }, 422);
    }

    /* Pembatas sederhana: maksimal 40 pertanyaan per 10 menit per user. */
    if (!bolehJalan(`asisten:${user.id}`, MAKS_BEDAH_SESI, JENDELA_SESI_DETIK)) {
        return jawab(
            {
                ok: false,
                error: `Batas ${MAKS_BEDAH_SESI} pertanyaan per 10 menit tercapai. Coba lagi beberapa saat lagi.`,
            },
            429,
        );
    }

    if (!siap()) {
        return jawab(
            { ok: false, error: "Asisten AI belum aktif. Fitur ini akan segera hadir." },
            503,
        );
    }

    const riwayat: Array<{ role: string; text: string }> = [];
    const riwayatMentah = form.get("riwayat");
    if (riwayatMentah) {
        try {
            const rr = JSON.parse(String(riwayatMentah)) as unknown;
            if (Array.isArray(rr)) {
                for (const turnRaw of rr.slice(-6)) {
                    const turn = turnRaw as Record<string, unknown>;
                    riwayat.push({
                        role: (turn["role"] ?? "user") === "asisten" ? "asisten" : "user",
                        text: String(turn["text"] ?? ""),
                    });
                }
            }
        } catch {
            /* riwayat rusak -> abaikan, pertanyaan tetap dijawab */
        }
    }

    const mulai = Date.now();
    const role: Role = normalisasiRole(user.role);
    const hasil = await tanya(tanyaTeks, riwayat, role);
    const detik = Math.round((Date.now() - mulai) / 100) / 10;

    if (!hasil.ok) {
        return jawab({ ok: false, error: String(hasil.error ?? "Gagal meminta jawaban.") }, 502);
    }

    return jawab({
        ok: true,
        jawaban: hasil.jawaban,
        model: hasil.model ?? "",
        sumber: hasil.konteks_label ?? "",
        detik,
    });
}

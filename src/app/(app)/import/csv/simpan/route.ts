import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { importCsv, type FlashImportCsv } from "@/lib/import-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /import/csv/simpan — Import berkas CSV (multipart: jenis + csv).
 * Port dari ImportController::csv. Ringkasan dikirim lewat flash
 * (success bila tidak ada baris gagal, warning bila ada) bersama daftar hasil.
 * Dipisah ke sub-segmen karena Next melarang page.tsx dan route.ts serumah.
 */
export async function POST(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
    }
    if (!roleBoleh(user.role, "import")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const form = await req.formData();
    const jenis = String(form.get("jenis") ?? "");
    const berkas = form.get("csv");
    if (!berkas || typeof berkas === "string" || berkas.size === 0) {
        return redirectFlash(req, "/import/csv", { error: "File CSV belum dipilih." });
    }

    const isi = await berkas.text();

    try {
        const { hasil, ringkas } = await importCsv(jenis, isi, user);
        const pesan = `Import selesai: ${ringkas.masuk} masuk, ${ringkas.lewati} dilewati, ${ringkas.gagal} gagal.`;
        const flash: FlashImportCsv = {
            hasil_import: hasil,
            ...(ringkas.gagal > 0 ? { warning: pesan } : { success: pesan }),
        };
        return redirectFlash(req, "/import/csv", flash);
    } catch (e) {
        const pesan = e instanceof Error ? e.message : String(e);
        return redirectFlash(req, "/import/csv", { error: `Import dibatalkan: ${pesan}` });
    }
}

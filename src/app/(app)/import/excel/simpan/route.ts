import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import {
    hapusSementara,
    importExcel,
    jalurSementara,
    pratinjauExcel,
    simpanSementara,
    type FlashImportExcel,
} from "@/lib/import-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /import/excel/simpan — Dua tahap:
 *   aksi_preview : baca unggahan, simpan ke os.tmpdir(), arahkan ke ?pratinjau=<token>
 *   aksi_import  : baca berkas sementara (token milik user), import, lalu hapus berkasnya
 * Port dari ImportController::excel. ONLY .xlsx; .xls ditolak (exceljs tidak membaca BIFF).
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

    if (form.get("aksi_preview")) {
        const berkas = form.get("xlsx");
        if (!berkas || typeof berkas === "string" || berkas.size === 0) {
            return redirectFlash(req, "/import/excel", { error: "File Excel belum dipilih atau upload gagal." });
        }
        const ext = (berkas.name.split(".").pop() ?? "").toLowerCase();
        if (ext !== "xlsx") {
            return redirectFlash(req, "/import/excel", { error: "File harus .xlsx." });
        }

        const buffer = new Uint8Array(await berkas.arrayBuffer());
        let token: string;
        try {
            /* Dibaca sekali untuk memastikan berkasnya sehat sebelum disimpan. */
            await pratinjauExcel(buffer);
            token = await simpanSementara(buffer, user.id);
        } catch (e) {
            const pesan = e instanceof Error ? e.message : String(e);
            return redirectFlash(req, "/import/excel", { error: `Gagal baca Excel: ${pesan}` });
        }
        return NextResponse.redirect(new URL(`/import/excel?pratinjau=${encodeURIComponent(token)}`, req.url), { status: 303 });
    }

    if (form.get("aksi_import")) {
        const token = String(form.get("file_token") ?? "");
        const penuh = await jalurSementara(token, user.id);
        if (!penuh) {
            return redirectFlash(req, "/import/excel", { error: "File preview sudah kadaluarsa. Upload ulang." });
        }

        try {
            const hasil = await importExcel(await fs.readFile(penuh), user);
            await hapusSementara(penuh);
            const flash: FlashImportExcel = {
                success: `Import selesai: ${hasil.masuk} masuk, ${hasil.lewati} dilewati (duplikat), ${hasil.gagal} gagal.`,
                hasil_excel: hasil,
            };
            return redirectFlash(req, "/import/excel", flash);
        } catch (e) {
            const pesan = e instanceof Error ? e.message : String(e);
            return redirectFlash(req, "/import/excel", { error: `Gagal import: ${pesan}` });
        }
    }

    return NextResponse.redirect(new URL("/import/excel", req.url), { status: 303 });
}

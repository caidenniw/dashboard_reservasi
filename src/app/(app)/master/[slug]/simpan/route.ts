import { NextResponse } from "next/server";
import { MASTER } from "@/config/master";
import { userSekarang } from "@/lib/auth";
import { bolehLihatModal, roleBoleh } from "@/lib/akses";
import { saringKolomModal, simpanMaster } from "@/lib/master-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /master/[slug] — Simpan (tambah/ubah) data master.
 * Pengganti MasterController::simpan + route master.simpan.
 * Form dikirim klasik (bukan Server Action) supaya modal konfirmasi app.js
 * dan redirect-with-flash bekerja sama seperti di Laravel.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const cfgAsli = MASTER[slug];
    if (!cfgAsli) {
        return new NextResponse("Halaman tidak ditemukan.", { status: 404 });
    }

    const user = await userSekarang();
    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (!roleBoleh(user.role, "master.tulis")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const cfg = saringKolomModal(cfgAsli, bolehLihatModal(user.role));
    const form = await req.formData();
    const hasil = await simpanMaster(cfg, form);

    if (hasil.errors.length > 0) {
        /* Sama seperti redirect()->back()->withInput()->with('master_errors', $errors). */
        const old: Record<string, string[]> = {};
        for (const c of cfg.kolom) {
            const v = form.get(c.name);
            if (typeof v === "string") {
                old[c.name] = [v];
            }
        }
        const id = Number(form.get("id") ?? 0) || 0;
        const tujuan = `/master/${slug}` + (id > 0 ? `?id=${id}` : "");
        return redirectFlash(req, tujuan, { error_validasi: hasil.errors, old });
    }

    return redirectFlash(req, `/master/${slug}`, { success: hasil.pesan ?? "Data berhasil disimpan." });
}

/*
 * POST /master/[slug]/hapus — Nonaktifkan/hapus data master.
 * Pengganti MasterController::hapus + route master.hapus.
 */
import { NextResponse } from "next/server";
import { MASTER } from "@/config/master";
import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { hapusMaster } from "@/lib/master-server";
import { redirectFlash } from "@/lib/flash-response";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const cfg = MASTER[slug];
    if (!cfg) {
        return new NextResponse("Halaman tidak ditemukan.", { status: 404 });
    }

    const user = await userSekarang();
    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (!roleBoleh(user.role, "master.tulis")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const form = await req.formData();
    const id = Number(form.get("id") ?? 0) || 0;
    const pesan = await hapusMaster(cfg, id);

    const flash = pesan === "Data tidak ditemukan." ? { error: pesan } : { success: pesan };
    return redirectFlash(req, `/master/${slug}`, flash);
}

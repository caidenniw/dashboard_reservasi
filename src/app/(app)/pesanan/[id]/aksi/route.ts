import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { jalankanAksi } from "@/lib/pesanan-aksi-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /pesanan/{id}/aksi — aksi dokumen pesanan (status, terbit, revisi, bayar, batal, hapus).
 * Port dari PesananAksiController::aksi (rute pesanan.aksi).
 *
 * Memakai form POST klasik (bukan Server Action) supaya modal konfirmasi di
 * app.js — yang memanggil form.submit() — tetap bekerja, dan redirect+flash
 * berperilaku persis seperti aplikasi lama.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const user = await userSekarang();
    if (!user) {
        return new Response(null, { status: 303, headers: { Location: "/login" } });
    }
    if (!roleBoleh(user.role, "pesanan.tulis")) {
        return new Response("Akses ditolak.", { status: 403 });
    }

    const { id } = await ctx.params;
    const idNum = Number(id) || 0;
    const form = await req.formData();
    const hasil = await jalankanAksi(idNum, form, user);

    if (!hasil) {
        return redirectFlash(req, "/pesanan", { error: "Pesanan tidak ditemukan." });
    }

    return redirectFlash(req, hasil.tujuan, hasil.flash);
}

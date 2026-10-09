import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { gantiBuktiBayar } from "@/lib/pesanan-aksi-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /pesanan/{id}/bukti/unggah — unggah/ganti berkas bukti pembayaran.
 * Port dari PesananDetailController::unggahBukti.
 * Perhatikan: {id} di sini adalah ID PEMBAYARAN (payments.id), bukan id pesanan —
 * sama seperti halaman GET /pesanan/{id}/bukti.
 *
 * Handler dipisah ke sub-path /unggah karena satu folder tidak boleh berisi
 * page.tsx dan route.ts sekaligus.
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
    const form = await req.formData();
    const hasil = await gantiBuktiBayar(Number(id) || 0, form);
    return redirectFlash(req, hasil.tujuan, hasil.flash);
}

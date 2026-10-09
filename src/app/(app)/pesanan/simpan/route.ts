import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { simpanPesanan } from "@/lib/pesanan-form-server";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /pesanan/simpan — Simpan (tambah/ubah) pesanan.
 * Port dari PesananFormController::simpan. Daftar galat lewat `error_validasi`
 * (dirender sebagai <ul>), isian lama disimpan di `old` untuk pengisian ulang.
 */
export async function POST(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return new Response(null, { status: 303, headers: { Location: "/login" } });
    }
    if (!roleBoleh(user.role, "pesanan.tulis")) {
        return new Response("Akses ditolak.", { status: 403 });
    }

    const form = await req.formData();
    const id = Number(form.get("id") ?? 0) || 0;
    const hasil = await simpanPesanan(form, user);

    if (hasil.errors.length > 0) {
        /* Simpan SEMUA isian (termasuk field berulang) supaya form bisa diisi ulang,
           sama seperti withInput() di Laravel. */
        const old: Record<string, string[]> = {};
        for (const [k, v] of form.entries()) {
            if (typeof v === "string") {
                (old[k] ??= []).push(v);
            }
        }
        const kembali = id > 0 ? `/pesanan/${id}/ubah` : "/pesanan/baru";
        return redirectFlash(req, kembali, { error_validasi: hasil.errors, old });
    }

    return redirectFlash(req, `/pesanan/${hasil.orderId}`, { success: hasil.pesan ?? "Pesanan tersimpan." });
}

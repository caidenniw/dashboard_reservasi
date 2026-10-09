import { NextResponse } from "next/server";
import { userSekarang, cekPassword, hashPassword } from "@/lib/auth";
import { query, execute } from "@/lib/db";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /profil/password/simpan — ganti password sendiri.
 * Port dari ProfilController::simpan (pesan galat disalin apa adanya).
 */
export async function POST(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }

    const form = await req.formData();
    const lama = String(form.get("password_lama") ?? "");
    const baru = String(form.get("password_baru") ?? "");
    const ulang = String(form.get("password_ulang") ?? "");

    const row = await query<{ password: string }>(
        "SELECT password FROM users WHERE id = ? LIMIT 1",
        [user.id],
    );
    const hashDb = row[0]?.password ?? "";

    if (!hashDb || !(await cekPassword(lama, hashDb))) {
        return redirectFlash(req, "/profil/password", { error: "Password lama salah." });
    }
    if (baru.length < 6) {
        return redirectFlash(req, "/profil/password", { error: "Password baru minimal 6 karakter." });
    }
    if (baru !== ulang) {
        return redirectFlash(req, "/profil/password", { error: "Konfirmasi password tidak sama." });
    }

    await execute("UPDATE users SET password = ? WHERE id = ?", [await hashPassword(baru), user.id]);

    return redirectFlash(req, "/", { success: "Password berhasil diubah." });
}

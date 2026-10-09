import { NextResponse } from "next/server";
import { userSekarang, hashPassword } from "@/lib/auth";
import { DAFTAR_ROLE, roleBoleh } from "@/lib/akses";
import { queryOne, execute } from "@/lib/db";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /user/perbarui — ubah data pengguna.
 * Port dari UserController::perbarui, termasuk pengaman agar Super Admin tidak
 * bisa menurunkan peran atau menonaktifkan akunnya sendiri.
 */
export async function POST(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (!roleBoleh(user.role, "user.kelola")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const form = await req.formData();
    const id = Number(form.get("id") ?? 0) || 0;

    const target = await queryOne<{ username: string; nama: string | null; role: string | null; is_active: number }>(
        "SELECT username, nama, role, is_active FROM users WHERE id = ? LIMIT 1",
        [id],
    );
    if (!target) {
        return redirectFlash(req, "/user", { error: "Pengguna tidak ditemukan." });
    }

    const nama = String(form.get("nama") ?? target.nama ?? "").trim();
    const role = String(form.get("role") ?? target.role ?? "reservasi");
    const aktif = Number(form.get("is_active") ?? 0) ? 1 : 0;
    const password = String(form.get("password") ?? "");

    const galat: string[] = [];
    if (nama === "") {
        galat.push("Nama wajib diisi.");
    }
    if (!(role in DAFTAR_ROLE)) {
        galat.push("Peran tidak dikenal.");
    }
    if (password !== "" && password.length < 6) {
        galat.push("Password baru minimal 6 karakter.");
    }

    /* pengaman: jangan sampai superadmin mengunci dirinya sendiri */
    if (id === user.id) {
        if (role !== "superadmin") {
            galat.push("Peran akun sendiri tidak bisa diturunkan dari Super Admin.");
        }
        if (aktif === 0) {
            galat.push("Akun sendiri tidak bisa dinonaktifkan.");
        }
    }
    if (galat.length > 0) {
        return redirectFlash(req, "/user", { error_validasi: galat });
    }

    if (password !== "") {
        await execute(
            "UPDATE users SET nama = ?, role = ?, is_active = ?, password = ? WHERE id = ?",
            [nama, role, aktif, await hashPassword(password), id],
        );
    } else {
        await execute(
            "UPDATE users SET nama = ?, role = ?, is_active = ? WHERE id = ?",
            [nama, role, aktif, id],
        );
    }

    let pesan = `Data pengguna "${target.username}" diperbarui.`;
    if (password !== "") {
        pesan += " Password barunya sudah diganti.";
    }

    return redirectFlash(req, "/user", { success: pesan });
}

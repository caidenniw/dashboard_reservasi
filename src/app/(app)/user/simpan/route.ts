import { NextResponse } from "next/server";
import { userSekarang, hashPassword } from "@/lib/auth";
import { DAFTAR_ROLE, roleBoleh, labelRole, type Role } from "@/lib/akses";
import { queryOne, execute } from "@/lib/db";
import { redirectFlash } from "@/lib/flash-response";
import { sekarangJakartaWaktu } from "@/lib/format";

/*
 * POST /user/simpan — tambah pengguna baru.
 * Port dari UserController::simpan. Daftar galat lewat kunci `error_validasi`
 * (BUKAN `error`) supaya dirender sebagai <ul>, sama seperti aplikasi lama.
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
    const username = String(form.get("username") ?? "").trim();
    const nama = String(form.get("nama") ?? "").trim();
    const role = String(form.get("role") ?? "reservasi");
    const password = String(form.get("password") ?? "");

    const galat: string[] = [];
    if (username === "") {
        galat.push("Username wajib diisi.");
    }
    if (nama === "") {
        galat.push("Nama wajib diisi.");
    }
    if (!(role in DAFTAR_ROLE)) {
        galat.push("Peran tidak dikenal.");
    }
    if (password.length < 6) {
        galat.push("Password minimal 6 karakter.");
    }
    if (username !== "") {
        const ada = await queryOne<{ id: number }>("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
        if (ada) {
            galat.push("Username sudah dipakai.");
        }
    }
    if (galat.length > 0) {
        return redirectFlash(req, "/user", { error_validasi: galat, old: { username: [username], nama: [nama], role: [role] } });
    }

    await execute(
        "INSERT INTO users (username, nama, password, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [username, nama, await hashPassword(password), role, Number(form.get("is_active") ?? 0) ? 1 : 0, sekarangJakartaWaktu()],
    );

    return redirectFlash(req, "/user", {
        success: `Pengguna "${username}" dibuat dengan peran ${labelRole(role as Role)}.`,
    });
}

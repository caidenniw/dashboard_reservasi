"use server";

import { redirect } from "next/navigation";
import { masuk, pasangSesi } from "@/lib/auth";
import { nextPathAman } from "@/lib/next-path";

/*
 * Server Action login — pengganti LoginController::masuk.
 * Aturan pesan galat disalin persis dari login.blade.php:
 * - kolom kosong  -> "Username dan password wajib diisi."
 * - kredensial salah -> "Username atau password salah."
 */

export interface HasilLogin {
    pesanSalah?: string;
    username?: string;
}

export async function loginAction(_prev: HasilLogin, formData: FormData): Promise<HasilLogin> {
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = nextPathAman(String(formData.get("next") ?? "/"));

    if (username === "" || password === "") {
        return { pesanSalah: "Username dan password wajib diisi.", username };
    }

    const user = await masuk(username, password);
    if (!user) {
        return { pesanSalah: "Username atau password salah.", username };
    }

    await pasangSesi(user);
    redirect(next);
}

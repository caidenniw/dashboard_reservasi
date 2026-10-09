import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { userSekarang, type SesiUser } from "@/lib/auth";

/*
 * Penjaga sesi sisi server. Middleware sudah menahan tamu, tetapi setiap
 * halaman/aksi WAJIB memeriksa ulang di sini (pertahanan berlapis) — sama
 * seperti middleware 'auth' + pemeriksaan di controller pada sistem lama.
 */

/** Dibungkus cache() supaya satu query per permintaan walau dipanggil berkali-kali. */
export const userPermintaan = cache(async (): Promise<SesiUser | null> => userSekarang());

export async function harusMasuk(): Promise<SesiUser> {
    const u = await userPermintaan();
    if (!u) {
        redirect("/login");
    }
    return u;
}

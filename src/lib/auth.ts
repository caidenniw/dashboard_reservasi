import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { normalisasiRole, type Role } from "@/lib/akses";

/*
 * Auth — pengganti Auth Laravel + sesi file.
 *
 * Memakai tabel `users` SISTEM LAMA apa adanya (username, nama, password bcrypt,
 * role, is_active). Hash bcrypt lama tetap valid — TIDAK ada perubahan data user.
 */

const NAMA_COOKIE = "rn_sesi";
const MASA_BERLAKU_DETIK = 60 * 60 * 12; // 12 jam

function kunci(): Uint8Array {
    const s = process.env.APP_KEY ?? process.env.SESSION_SECRET ?? "";
    if (s.length < 16) {
        throw new Error(
            "APP_KEY belum diisi (minimal 16 karakter) di .env — wajib untuk menandatangani sesi.",
        );
    }
    return new TextEncoder().encode(s);
}

export interface SesiUser {
    id: number;
    nama: string;
    username: string;
    role: Role;
}

interface BarisUser {
    id: number;
    username: string;
    nama: string | null;
    panggilan: string | null;
    role: string | null;
    password: string;
    is_active: number;
}

/** Verifikasi password terhadap hash bcrypt PHP.
 *  PHP memakai prefix `$2y$`; bcryptjs mengenali `$2b$`. Algoritmanya identik,
 *  jadi cukup menormalkan prefix saat membandingkan. */
export async function cekPassword(plain: string, hashDb: string): Promise<boolean> {
    const hash = hashDb.replace(/^\$2y\$/, "$2b$");
    try {
        return await bcrypt.compare(plain, hash);
    } catch {
        return false;
    }
}

/** Buat hash password baru. biaya 12 = BCRYPT_ROUNDS di .env, dan hasilnya ($2b$)
 *  tetap bisa diverifikasi PHP (password_verify menerima $2a$/$2b$). */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
}

/** Coba login; kembalikan sesi bila berhasil, null bila gagal. */
export async function masuk(username: string, password: string): Promise<SesiUser | null> {
    /*
     * `is_active = 1` ikut ke dalam WHERE — sama seperti Auth::attempt([... , 'is_active' => 1]).
     * Akibatnya user nonaktif memberi pesan galat yang SAMA dengan password salah.
     *
     * CATATAN: kolom `last_login` TIDAK ditulis di sini, karena LoginController
     * aplikasi lama juga tidak pernah menulisnya. Kita tidak menambah perubahan
     * data yang tidak dilakukan sistem lama.
     */
    const u = await queryOne<BarisUser>(
        "SELECT id, username, nama, panggilan, role, password, is_active FROM users WHERE username = ? AND is_active = 1 LIMIT 1",
        [username],
    );

    if (!u) {
        return null;
    }
    if (!(await cekPassword(password, u.password))) {
        return null;
    }

    return {
        id: Number(u.id),
        nama: String(u.nama ?? u.username),
        username: String(u.username),
        role: normalisasiRole(u.role),
    };
}

/** Terbitkan cookie sesi (HttpOnly, ditandatangani JWT). */
export async function pasangSesi(user: SesiUser): Promise<void> {
    const token = await new SignJWT({
        uid: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${MASA_BERLAKU_DETIK}s`)
        .sign(kunci());

    const jar = await cookies();
    jar.set(NAMA_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MASA_BERLAKU_DETIK,
    });
}

/** Hapus cookie sesi (logout). */
export async function hapusSesi(): Promise<void> {
    const jar = await cookies();
    jar.delete(NAMA_COOKIE);
}

/** Ambil user yang sedang masuk dari cookie, atau null. */
export async function userSekarang(): Promise<SesiUser | null> {
    const jar = await cookies();
    const token = jar.get(NAMA_COOKIE)?.value;
    if (!token) {
        return null;
    }
    try {
        const { payload } = await jwtVerify(token, kunci());
        /* Pastikan user masih aktif di database. */
        const aktif = await queryOne<{ is_active: number; nama: string | null; role: string | null }>(
            "SELECT is_active, nama, role FROM users WHERE id = ? LIMIT 1",
            [payload.uid],
        );
        if (!aktif || Number(aktif.is_active) !== 1) {
            return null;
        }
        return {
            id: Number(payload.uid),
            username: String(payload.username ?? ""),
            nama: String(aktif.nama ?? payload.nama ?? ""),
            role: normalisasiRole(aktif.role ?? payload.role),
        };
    } catch {
        return null;
    }
}

/** Nama pendek user untuk kode order & warna kalender (port panggilanReservasi). */
export async function panggilanReservasi(userId?: number): Promise<string> {
    const u = userId
        ? await queryOne<{ panggilan: string | null; nama: string | null; username: string | null }>(
            "SELECT panggilan, nama, username FROM users WHERE id = ? LIMIT 1",
            [userId],
        )
        : null;
    const sumber = u ?? (await userSekarang());
    if (!sumber) {
        return "";
    }
    const rec = sumber as Record<string, unknown>;
    let p = String(rec.panggilan ?? "").trim()
        || String(rec.nama ?? "").trim()
        || String(rec.username ?? "").trim();
    p = p.split(" ")[0] ?? "";
    return p.replace(/[^A-Za-z0-9]/g, "");
}

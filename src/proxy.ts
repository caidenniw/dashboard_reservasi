import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { NAMA_COOKIE_FLASH } from "@/lib/flash";

/*
 * Proxy (sebelumnya "middleware" — berganti nama di Next.js 16):
 * 1. Penjaga rute — halaman terproteksi wajib punya sesi valid; kalau tidak,
 *    diarahkan ke /login?next=<halaman yang dituju>.
 * 2. Penerus flash — nilai cookie `rn_flash` diteruskan ke render server lewat
 *    header `x-rn-flash`, lalu cookie-nya DIHAPUS supaya pesan hanya muncul sekali.
 *    (Server Component bisa membaca cookie tapi tidak bisa menghapusnya — maka
 *    penghapusan dilakukan di sini.)
 */

const PUBLIK = ["/login"];

function kunci(): Uint8Array {
    const s = process.env.APP_KEY ?? process.env.SESSION_SECRET ?? "";
    return new TextEncoder().encode(s || "kunci-sesi-belum-disetel");
}

async function sesiValid(token: string | undefined): Promise<boolean> {
    if (!token) {
        return false;
    }
    try {
        await jwtVerify(token, kunci());
        return true;
    } catch {
        return false;
    }
}

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = req.cookies.get("rn_sesi")?.value;
    const masuk = await sesiValid(token);

    /* --- Penjaga rute --- */
    const publik = PUBLIK.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!masuk && !publik) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        const tujuan = pathname + search;
        if (tujuan && tujuan !== "/") {
            url.searchParams.set("next", tujuan);
        }
        return NextResponse.redirect(url);
    }
    if (masuk && pathname === "/login") {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
    }

    /* --- Penerusan + penghapusan flash, sekaligus pathname untuk layout --- */
    const flash = req.cookies.get(NAMA_COOKIE_FLASH)?.value;
    const headers = new Headers(req.headers);
    headers.set("x-rn-path", pathname);
    if (flash) {
        headers.set("x-rn-flash", flash);
    }
    const res = NextResponse.next({ request: { headers } });
    if (flash) {
        res.cookies.delete(NAMA_COOKIE_FLASH);
    }
    return res;
}

export const config = {
    /*
     * Jalankan di semua rute kecuali aset statis & API internal Next.
     * API kita sendiri (parse-pesanan / asisten) dijaga di dalam handler-nya.
     */
    matcher: ["/((?!_next/static|_next/image|assets|favicon.ico|uploads|robots.txt).*)"],
};

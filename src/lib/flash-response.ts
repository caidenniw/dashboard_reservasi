import { NextResponse } from "next/server";
import { tandaiFlash, NAMA_COOKIE_FLASH, type FlashData } from "@/lib/flash";

/**
 * Redirect + pasang cookie flash.
 * Dipakai Route Handler yang menggantikan pola Laravel
 * `redirect()->route(...)->with('success', ...)`.
 *
 * Cookie flash diteruskan ke render server oleh proxy.ts (header x-rn-flash),
 * lalu dihapus supaya pesannya muncul sekali.
 */
export async function redirectFlash(
    req: Request,
    path: string,
    flash: FlashData,
): Promise<NextResponse> {
    const res = NextResponse.redirect(new URL(path, req.url), { status: 303 });
    res.cookies.set(NAMA_COOKIE_FLASH, await tandaiFlash(flash), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60,
    });
    return res;
}

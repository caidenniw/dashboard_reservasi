import { NextResponse } from "next/server";
import { hapusSesi } from "@/lib/auth";

/*
 * Logout — pengganti LoginController::keluar.
 * POST /logout -> hapus cookie sesi -> kembali ke /login.
 */
export async function POST(req: Request) {
    await hapusSesi();
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

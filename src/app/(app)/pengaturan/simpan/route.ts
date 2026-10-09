import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { simpanSetting } from "@/lib/settings";
import { query } from "@/lib/db";
import { redirectFlash } from "@/lib/flash-response";

/*
 * POST /pengaturan/simpan — simpan semua nilai pengaturan.
 * Port dari PengaturanController::simpan.
 */
export async function POST(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (!roleBoleh(user.role, "pengaturan")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const form = await req.formData();
    const kunci = await query<{ key: string }>("SELECT `key` FROM settings");
    for (const row of kunci) {
        if (form.has(row.key)) {
            await simpanSetting(row.key, String(form.get(row.key) ?? "").trim());
        }
    }

    return redirectFlash(req, "/pengaturan", {
        success: "Pengaturan tersimpan. Kop invoice akan memakai nilai terbaru.",
    });
}

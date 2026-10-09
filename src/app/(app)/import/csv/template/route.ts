import { NextResponse } from "next/server";
import { userSekarang } from "@/lib/auth";
import { roleBoleh } from "@/lib/akses";
import { KOLOM_TEMPLATE } from "@/lib/import-server";

/*
 * GET /import/csv/template?jenis=unit|driver|customer|pesanan — unduh template CSV.
 * Port dari ImportController::template (BOM UTF-8 + satu baris nama kolom).
 * Jenis tak dikenal memakai kolom ['kosong'].
 */
export async function GET(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
    }
    if (!roleBoleh(user.role, "import")) {
        return new NextResponse("Akses ditolak.", { status: 403 });
    }

    const jenis = new URL(req.url).searchParams.get("jenis") ?? "";
    const kolom = KOLOM_TEMPLATE[jenis] ?? ["kosong"];
    const aman = jenis.replace(/[^A-Za-z0-9_-]/g, "");

    /* BOM UTF-8 supaya Excel membaca huruf beraksen dengan benar. */
    const isi = `\uFEFF${kolom.join(";")}\r\n`;

    return new NextResponse(isi, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="template_${aman}.csv"`,
        },
    });
}

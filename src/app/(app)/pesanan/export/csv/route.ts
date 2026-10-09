import { userSekarang } from "@/lib/auth";
import { bolehLihatModal, roleBoleh } from "@/lib/akses";
import { filterDari, barisExportCsv } from "@/lib/pesanan-server";
import { sekarangJakarta } from "@/lib/format";

/*
 * GET /pesanan/export/csv — Export CSV daftar pesanan.
 * Port dari PesananController::exportCsv (kolom & urutan sama, BOM UTF-8,
 * tanpa LIMIT, kolom modal disembunyikan bila peran tidak berhak).
 */
export async function GET(req: Request) {
    const user = await userSekarang();
    if (!user) {
        return new Response("Akses ditolak.", { status: 403 });
    }
    if (!roleBoleh(user.role, "pesanan.lihat")) {
        return new Response("Akses ditolak.", { status: 403 });
    }

    const url = new URL(req.url);
    const sp: Record<string, string | string[] | undefined> = {};
    url.searchParams.forEach((v, k) => {
        sp[k] = v;
    });

    const f = filterDari(sp);
    const bolehModal = bolehLihatModal(user.role);
    const baris = await barisExportCsv(f, bolehModal);

    const isi = baris.map((r) => r.map(kutipCsv).join(",")).join("\r\n") + "\r\n";

    /* BOM UTF-8 supaya Excel membaca huruf beraksen dengan benar. */
    return new Response("﻿" + isi, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="pesanan_${sekarangJakarta()}.csv"`,
        },
    });
}

/** Kutip nilai CSV bila mengandung koma, kutip, atau baris baru. */
function kutipCsv(v: string): string {
    if (v === "") {
        return "";
    }
    if (/[",\r\n]/.test(v)) {
        return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
}

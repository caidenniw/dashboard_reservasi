import type { Metadata } from "next";
import { cache } from "react";
import { harusMasuk } from "@/lib/sesi";
import { bolehLihatModal, labelRole, roleBoleh, type Role } from "@/lib/akses";
import { ambilInvoiceCetak } from "@/lib/invoice-cetak-server";
import { InvoiceKlasik } from "./_klasik";
import { InvoiceModern } from "./_modern";

/*
 * Halaman cetak invoice — port dari route invoice.cetak (routes/invoice.php)
 * dan InvoiceController::cetak.
 *
 * Berada DI LUAR grup (app) supaya tanpa sidebar/topbar: dokumen berdiri sendiri
 * seperti Blade (yang menulis <html> sendiri). Dipakai sebagai tab baru dan
 * sebagai iframe pratinjau (?embed=1) di halaman detail pesanan.
 *
 * Catatan penyimpangan dari Laravel (disengaja, lihat juga kartu di bawah):
 *  - Penolakan peran TIDAK memakai redirect + flash, karena Server Component tidak
 *    bisa menulis cookie flash. Pesan error-nya SAMA PERSIS dengan Laravel, tetapi
 *    ditampilkan sebagai kartu di halaman ini.
 *  - Karena itu tautan "Dasbor" ditambahkan sebagai jalan keluar (Laravel selalu
 *    melempar pengguna ke halaman lain, jadi tidak pernah berakhir di halaman kosong).
 */

/** Satu kali fetch data per permintaan (generateMetadata + render memakai hasil yang sama). */
const ambilCetak = cache(async (id: number) => ambilInvoiceCetak(id));

/** Gerbang peran — kembalikan pesan penolakan (null = boleh). Teks sama seperti Laravel. */
function gerbangPeran(role: Role, mode: string, mintaFinal: boolean): string | null {
    if (!roleBoleh(role, "pesanan.lihat")) {
        return `Halaman itu tidak tersedia untuk peran ${labelRole(role)}.`;
    }
    if (mode === "internal" && !bolehLihatModal(role)) {
        return "Lembar internal (memuat modal & margin) hanya untuk Super Admin / Owner.";
    }
    if (mintaFinal && !roleBoleh(role, "invoice.cetak_final")) {
        return "Cetak invoice FINAL hanya untuk peran Finance / Super Admin.";
    }
    if (!mintaFinal && !roleBoleh(role, "invoice.cetak_sementara") && !roleBoleh(role, "invoice.cetak_final")) {
        return "Peran kamu tidak berhak mencetak invoice.";
    }
    return null;
}

function bacaQuery(sp: Record<string, string | string[] | undefined>) {
    const satu = (k: string) => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v ?? "").trim();
    };
    const modeMentah = satu("mode");
    return {
        mode: (modeMentah === "internal" ? "internal" : "customer") as "internal" | "customer",
        embed: satu("embed") === "1",
        mintaFinal: modeMentah === "final",
    };
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
    const { mode, mintaFinal } = bacaQuery(await searchParams);
    const user = await harusMasuk();
    if (gerbangPeran(user.role, mode, mintaFinal) !== null) {
        return { title: { absolute: "Invoice" } };
    }

    const id = Number((await params).id) || 0;
    const hasil = await ambilCetak(id);
    if (hasil.jenis !== "data") {
        return { title: { absolute: "Invoice" } };
    }
    /* Judul mengikuti masing-masing template Blade (template modern selalu "Invoice"). */
    const awalan = hasil.data.template === "modern" || mode !== "internal" ? "Invoice" : "Lembar Internal";
    return { title: { absolute: `${awalan} ${hasil.data.inv.nomor_invoice}` } };
}

/** Kartu penolakan — berisi pesan penolakan Laravel apa adanya. */
function KartuTolak({ pesan }: { pesan: string }) {
    return (
        <div style={{ padding: "28px 18px" }}>
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-2">{pesan}</p>
                <a className="btn btn-sm btn-outline-secondary" href="/pesanan">Buka Data Pesanan &amp; Faktur</a>
            </div>
        </div>
    );
}

export default async function HalamanCetakInvoice({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await harusMasuk();
    const { mode, embed, mintaFinal } = bacaQuery(await searchParams);

    const tolak = gerbangPeran(user.role, mode, mintaFinal);
    if (tolak !== null) {
        return <KartuTolak pesan={tolak} />;
    }

    const id = Number((await params).id) || 0;
    const hasil = await ambilCetak(id);
    if (hasil.jenis === "teks") {
        /* Sama seperti `response('…')` di Laravel: teks biasa, bukan halaman error. */
        return hasil.pesan;
    }

    return hasil.data.template === "modern" ? (
        <InvoiceModern d={hasil.data} mode={mode} embed={embed} />
    ) : (
        <InvoiceKlasik d={hasil.data} mode={mode} embed={embed} />
    );
}

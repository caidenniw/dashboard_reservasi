import type { KolomMaster } from "@/config/master";
import type { Opsi } from "@/lib/master-server";
import { rupiah } from "@/lib/format";

/** Satu sel tabel master — port dari master/nilai.blade.php. */
export function NilaiMaster({
    c,
    nilai,
    opsi,
}: {
    c: KolomMaster | undefined;
    nilai: unknown;
    opsi: Opsi;
}) {
    if (c && c.tipe === "rupiah") {
        return <span className="num">{rupiah(nilai as number, false)}</span>;
    }
    if (c && c.tipe === "foto") {
        if (nilai !== "" && nilai !== null && nilai !== undefined) {
            const src = `/${String(nilai).replace(/^\/+/, "")}`;
            return (
                <a href={src} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Foto driver" className="thumb-tabel" />
                </a>
            );
        }
        return <span className="text-soft">belum ada</span>;
    }
    if (c && c.tipe === "select") {
        const cocok = opsi.find(([v]) => v === String(nilai));
        return <>{cocok ? cocok[1] : String(nilai ?? "")}</>;
    }
    if (c && c.tipe === "tel") {
        if (nilai !== "" && nilai !== null && nilai !== undefined) {
            const wa = String(nilai).replace(/[^0-9]/g, "");
            return (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener">{String(nilai)}</a>
            );
        }
        return <>-</>;
    }
    return <>{String(nilai ?? "")}</>;
}

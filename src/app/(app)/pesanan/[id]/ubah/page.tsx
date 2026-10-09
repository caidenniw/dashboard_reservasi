import { notFound } from "next/navigation";
import { FormPesanan } from "../../_form";
import { ambilOrder } from "@/lib/app-lib";

/* Ubah Pesanan — port dari route pesanan.ubah. */
export default async function HalamanPesananUbah({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const idNum = Number(id) || 0;
    if (idNum <= 0) {
        notFound();
    }
    const order = await ambilOrder(idNum);
    if (!order) {
        notFound();
    }
    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pesanan · Ubah</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Ubah Pesanan</h1>
                <p className="text-ink-soft mt-2">Perbarui data pesanan yang sudah tercatat.</p>
            </div>

            <FormPesanan id={idNum} />
        </>
    );
}

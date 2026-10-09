import { FormPesanan } from "../_form";

/* Input Pesanan Baru — port dari route pesanan.baru. */
export default async function HalamanPesananBaru() {
    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pesanan · Input</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Input Pesanan Baru</h1>
                <p className="text-ink-soft mt-2">Buat pesanan lewat form terstruktur atau tempel teks pesanan.</p>
            </div>

            <FormPesanan id={0} />
        </>
    );
}

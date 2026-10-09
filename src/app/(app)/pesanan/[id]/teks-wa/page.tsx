import { notFound } from "next/navigation";
import { harusMasuk } from "@/lib/sesi";
import { ambilOrder, teksWaOrder } from "@/lib/app-lib";
import { daftarTemplatePesan } from "@/lib/settings";
import { TombolSalin } from "@/components/tombol-salin";
import { BalasanCepat } from "@/components/balasan-cepat";

/*
 * Teks Konfirmasi WhatsApp — port 1:1 dari pesanan/wa.blade.php.
 * Tanpa baris modal & margin (memang tidak dimasukkan oleh teksWaOrder()).
 */
export default async function HalamanTeksWa({ params }: { params: Promise<{ id: string }> }) {
    await harusMasuk();
    const { id } = await params;
    const idNum = Number(id) || 0;
    if (idNum <= 0) {
        notFound();
    }

    const order = await ambilOrder(idNum);
    if (!order) {
        notFound();
    }

    const teks = await teksWaOrder(order);
    const waPic = String(order.hp_pic ?? "").replace(/[^0-9]/g, "");
    const tpl = await daftarTemplatePesan();

    return (
        <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold mb-1 text-ink">Teks siap kirim ke customer</h2>
                    <div className="text-sm text-ink-soft mt-0">
                        Format mengikuti template lama (Pelayanan, Driver, Unit, Nopol, Standby, Flight, Jam, Pesanan, PIC, Include).
                        Baris modal &amp; margin tidak ikut disalin.
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <TombolSalin idTeks="teksWa" idTombol="btnSalin" />
                    {waPic !== "" && (
                        <a
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors"
                            target="_blank"
                            rel="noopener"
                            href={`https://wa.me/${waPic}?text=${encodeURIComponent(teks)}`}
                        >
                            Buka WhatsApp PIC
                        </a>
                    )}
                    <a className="px-3 py-1.5 text-xs font-medium rounded-md border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={`/pesanan/${idNum}`}>Kembali</a>
                </div>
            </div>

            <BalasanCepat idTeks="teksWa" daftar={tpl} />
            <label className="block text-sm font-medium mt-6 mb-2 text-ink-soft" htmlFor="teksWa">Isi Pesan</label>
            <textarea
                id="teksWa"
                className="w-full p-3 rounded-lg border border-line-strong bg-surface text-ink font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                rows={26}
                spellCheck={false}
                defaultValue={teks}
            />
        </div>
    );
}

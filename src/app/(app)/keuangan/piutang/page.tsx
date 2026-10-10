import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { ambilPiutang, TabelRekapPiutang, TabelDetailPiutang } from "../_tabel-piutang";

/*
 * Piutang Pelanggan — invoice belum lunas + tombol Reminder WA. HANYA MEMBACA.
 * Query & tabel dibagi dengan seksi piutang di laporan penjualan
 * lewat ../keuangan/_tabel-piutang (satu sumber kebenaran).
 */
export default async function HalamanPiutang() {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "keuangan.bayar")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Piutang Pelanggan.</p>
            </div>
        );
    }

    const { piutang, piutangCustomer, totalPiutang } = await ambilPiutang();

    return (
        <>
            <div className="card-box">
                <div className="card-title">Rekap Piutang per Customer</div>
                <TabelRekapPiutang rows={piutangCustomer} total={totalPiutang} />
            </div>
            <div className="card-box">
                <div className="card-title">Daftar Invoice Belum Lunas</div>
                <p className="text-soft">
                    Invoice terbit/sebagian yang masih punya sisa tagihan, diurut dari jatuh tempo terlama.
                    Lewat jatuh tempo ditandai merah. Reminder membuka WhatsApp dengan pesan siap kirim.
                </p>
                <TabelDetailPiutang rows={piutang} total={totalPiutang} />
            </div>
        </>
    );
}

import { harusMasuk } from "@/lib/sesi";
import { menuTampil, roleBoleh } from "@/lib/akses";
import { query } from "@/lib/db";
import { rupiah, tglId, normalisasiHp } from "@/lib/format";
import { PETA_MODUL, type KartuModul } from "@/config/modul";
import { MENU, cariMenu, type ItemMenu } from "@/config/menu";

/*
 * Beranda — PETA MODUL (peluncur menu), bukan panel informasi.
 * Tiap kartu mengarah langsung ke halaman modulnya; ikon/href diambil dari
 * config/menu, visibilitas peran lewat menuTampil() persis seperti sidebar.
 */

/** Satu baris invoice lewat jatuh tempo (untuk kartu "Perlu ditagih"). */
interface BarisJatuhTempo {
    order_id: number;
    nomor_invoice: string;
    jatuh_tempo: string;
    sisa: string;
    nama_pesanan: string | null;
    hp_pic: string | null;
}

/** Pasangan kartu + menu yang ditemukan (null bila kunci tak dikenal). */
interface KartuSiap {
    kartu: KartuModul;
    menu: ItemMenu;
}

export default async function HalamanBeranda() {
    const user = await harusMasuk();

    /* Kumpulkan kartu yang lolos filter peran dan punya menu tujuan. */
    const perSeksi: Array<{ seksi: string; kartu: KartuSiap[] }> = [];
    for (const sek of PETA_MODUL) {
        const siap: KartuSiap[] = [];
        for (const km of sek.kartu) {
            if (!menuTampil(user.role, km.key)) {
                continue;
            }
            const menu = cariMenu(MENU, km.key);
            if (menu && menu.href !== "") {
                siap.push({ kartu: km, menu });
            }
        }
        if (siap.length > 0) {
            perSeksi.push({ seksi: sek.seksi, kartu: siap });
        }
    }

    /* Kartu "Perlu ditagih" — hanya peran yang boleh mencatat pembayaran. */
    const bolehTagih = roleBoleh(user.role, "keuangan.bayar");
    const jatuhTempo = bolehTagih
        ? await query<BarisJatuhTempo>(
            `SELECT i.order_id, i.nomor_invoice, i.jatuh_tempo, i.sisa, o.nama_pesanan, o.hp_pic
             FROM invoices i JOIN orders o ON o.id = i.order_id
             WHERE i.status IN ('terbit', 'sebagian') AND i.sisa > 0
               AND i.jatuh_tempo IS NOT NULL AND i.jatuh_tempo < CURDATE()
             ORDER BY i.jatuh_tempo, i.id
             LIMIT 10`,
        )
        : [];
    const ringkasTagih = bolehTagih && jatuhTempo.length > 0
        ? (await query<{ c: number; s: string }>(
            `SELECT COUNT(*) c, COALESCE(SUM(sisa), 0) s FROM invoices
             WHERE status IN ('terbit', 'sebagian') AND sisa > 0
               AND jatuh_tempo IS NOT NULL AND jatuh_tempo < CURDATE()`,
        ))[0]
        : null;
    /* Strip KPI bisnis — agregat read-only, tanpa DDL. */
    const resBulan = (await query<{ c: number }>(
        `SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL
         AND DATE_FORMAT(tgl_mulai,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')`,
    ))[0]?.c ?? 0;
    const resLalu = (await query<{ c: number }>(
        `SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL
         AND DATE_FORMAT(tgl_mulai,'%Y-%m')=DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 1 MONTH),'%Y-%m')`,
    ))[0]?.c ?? 0;
    const uangBulan = Number((await query<{ s: string }>(
        `SELECT COALESCE(SUM(nominal),0) s FROM payments
         WHERE DATE_FORMAT(tanggal_bayar,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')`,
    ))[0]?.s ?? 0);
    const uangLalu = Number((await query<{ s: string }>(
        `SELECT COALESCE(SUM(nominal),0) s FROM payments
         WHERE DATE_FORMAT(tanggal_bayar,'%Y-%m')=DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 1 MONTH),'%Y-%m')`,
    ))[0]?.s ?? 0);
    const armadaAktif = (await query<{ c: number }>(
        `SELECT COUNT(*) c FROM units WHERE deleted_at IS NULL AND status <> 'nonaktif'`,
    ))[0]?.c ?? 0;
    const menunggu = (await query<{ c: number }>(
        `SELECT COUNT(*) c FROM orders WHERE deleted_at IS NULL
         AND status IN ('draft','inquiry','quoted','waiting_dp')`,
    ))[0]?.c ?? 0;
    const pending = (await query<{ c: number }>(
        `SELECT COUNT(*) c FROM invoices WHERE status IN ('terbit','sebagian')`,
    ))[0]?.c ?? 0;
    const delta = (cur: number, prev: number): string =>
        prev === 0 ? "—" : `${cur >= prev ? "+" : ""}${Math.round((cur - prev) / prev * 100)}%`;

    return (
        <>

            <div className="page-head">
                <span className="text-xs font-medium text-ink-soft uppercase tracking-wider">1000 Nusantara &middot; Pusat Operasional</span>
                <h1 className="text-3xl font-bold text-ink mt-1 mb-2">Peta Modul</h1>
                <p className="text-ink-soft max-w-2xl">
                    Semua ruang kerja dalam satu layar &mdash; pilih modul untuk masuk
                    ke menu kerjanya.
                </p>
            </div>
            <section className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <div className="card-box p-4 bg-surface border border-line rounded-xl shadow-sm">
                    <div className="text-2xl font-bold text-ink">{resBulan}</div>
                    <div className="text-sm text-ink-soft">Reservasi Bulan Ini</div>
                    <div className="text-xs text-ink-soft mt-1">{delta(resBulan, resLalu)} vs bulan lalu</div>
                </div>
                {bolehTagih && (
                    <div className="card-box p-4 bg-surface border border-line rounded-xl shadow-sm">
                        <div className="text-2xl font-bold text-ink">{rupiah(uangBulan, false)}</div>
                        <div className="text-sm text-ink-soft">Pendapatan Bulan Ini</div>
                        <div className="text-xs text-ink-soft mt-1">{delta(uangBulan, uangLalu)} vs bulan lalu</div>
                    </div>
                )}
                <div className="card-box p-4 bg-surface border border-line rounded-xl shadow-sm">
                    <div className="text-2xl font-bold text-ink">{armadaAktif}</div>
                    <div className="text-sm text-ink-soft">Armada Aktif</div>
                </div>
                <div className="card-box p-4 bg-surface border border-line rounded-xl shadow-sm">
                    <div className="text-2xl font-bold text-ink">{menunggu}</div>
                    <div className="text-sm text-ink-soft">Menunggu Konfirmasi</div>
                </div>
                <div className="card-box p-4 bg-surface border border-line rounded-xl shadow-sm">
                    <div className="text-2xl font-bold text-ink">{pending}</div>
                    <div className="text-sm text-ink-soft">Pembayaran Pending</div>
                </div>
            </section>

            {ringkasTagih && (
                <section className="card-box p-6 bg-surface border border-line rounded-xl shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-lg font-semibold text-ink">Perlu ditagih</h2>
                        <span className="badge-pill pill-red">LEWAT JATUH TEMPO</span>
                    </div>
                    <p className="text-sm text-ink-soft mb-4">
                        {Number(ringkasTagih.c)} invoice lewat jatuh tempo &mdash; sisa total{" "}
                        <b className="text-ink">{rupiah(ringkasTagih.s, false)}</b>. Urut dari yang paling lama.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <caption className="visually-hidden">Invoice lewat jatuh tempo</caption>
                            <thead className="bg-surface-2 text-ink-soft font-medium">
                                <tr>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Invoice</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Customer</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line">Jatuh Tempo</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line text-right">Sisa</th>
                                    <th className="px-3 py-2 font-semibold border-b border-line"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {jatuhTempo.map((p) => {
                                    const digits = normalisasiHp(p.hp_pic).replace(/[^0-9]/g, "");
                                    const pesan = digits === "" ? null : `https://wa.me/${digits}?text=${encodeURIComponent(`Yth ${p.nama_pesanan ?? "-"}, tagihan ${p.nomor_invoice} sisa ${rupiah(p.sisa, false)}, jatuh tempo ${tglId(p.jatuh_tempo)}. Mohon info pembayarannya. Terima kasih.`)}`;
                                    return (
                                    <tr key={p.nomor_invoice} className="hover:bg-surface-2 transition-colors">
                                        <td className="px-3 py-2 font-mono">{p.nomor_invoice}</td>
                                        <td className="px-3 py-2">{p.nama_pesanan || "-"}</td>
                                        <td className="px-3 py-2">{tglId(p.jatuh_tempo)}</td>
                                        <td className="px-3 py-2 text-right font-medium">{rupiah(p.sisa, false)}</td>
                                        <td className="px-3 py-2 text-right">
                                            {pesan
                                                ? <a className="px-3 py-1 border border-line text-ink-soft text-xs font-medium rounded hover:bg-surface-2 transition-colors mr-1" target="_blank" rel="noopener noreferrer" href={pesan}>Reminder</a>
                                                : null}
                                            <a className="px-3 py-1 border border-line text-ink-soft text-xs font-medium rounded hover:bg-surface-2 transition-colors" href={`/pesanan/${p.order_id}`}>Bayar</a>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {perSeksi.map((sek) => (
                <section className="modul-seksi" key={sek.seksi}>
                    <h2 className="text-lg font-semibold text-ink mb-4">{sek.seksi}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sek.kartu.map(({ kartu: km, menu }) => (
                            <a className="group relative flex flex-col p-4 bg-surface border border-line rounded-xl transition-all hover:border-primary hover:shadow-md hover:-translate-y-1" href={menu.href} key={km.key}>
                                <div className="flex items-center justify-between mb-3">
                                    <span
                                        className="text-2xl"
                                        dangerouslySetInnerHTML={{ __html: menu.icon }}
                                    />
                                    <svg
                                        className="text-ink-faint group-hover:text-primary transition-colors"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M7 7h10v10" />
                                        <path d="M7 17 17 7" />
                                    </svg>
                                </div>
                                <div className="font-bold text-ink group-hover:text-primary transition-colors">{km.judul}</div>
                                <div className="text-sm text-ink-soft mb-4 leading-relaxed">{km.desc}</div>
                                <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
                                    Buka modul
                                    <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M5 12h14" />
                                        <path d="m12 5 7 7-7 7" />
                                    </svg>
                                </span>
                            </a>
                        ))}
                    </div>
                </section>
            ))}
        </>
    );
}

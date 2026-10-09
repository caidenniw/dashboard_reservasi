import { promises as fs } from "node:fs";
import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { ambilFlash } from "@/lib/flash-server";
import { rupiah } from "@/lib/format";
import {
    jalurSementara,
    pratinjauExcel,
    type BarisPratinjau,
    type FlashImportExcel,
    type RingkasExcel,
} from "@/lib/import-server";

/*
 * Import Excel (Orderan) — port dari import/excel.blade.php + ImportController::excel (GET).
 * Alur 2 tahap: unggah -> pratinjau (berkas disimpan sementara di os.tmpdir, token dibawa
 * di URL `?pratinjau=`) -> konfirmasi import lewat form kedua.
 */

const RINGKAS_KOSONG: RingkasExcel = { total: 0, siap: 0, lewati: 0, error: 0 };

export default async function HalamanImportExcel({
    searchParams,
}: {
    searchParams: Promise<{ pratinjau?: string }>;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "import")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Import Excel.</p>
            </div>
        );
    }

    const sp = await searchParams;
    const flash = (await ambilFlash()) as FlashImportExcel;

    let preview: BarisPratinjau[] = [];
    let ringkas: RingkasExcel = RINGKAS_KOSONG;
    let token = "";
    if (sp.pratinjau) {
        const penuh = await jalurSementara(sp.pratinjau, user.id);
        if (penuh) {
            token = sp.pratinjau;
            const hasil = await pratinjauExcel(await fs.readFile(penuh));
            preview = hasil.preview;
            ringkas = hasil.ringkas;
        }
    }

    const hasilImport = flash.hasil_excel;

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sistem & Tools · Import</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Import Excel (Orderan)</h1>
                <p className="text-ink-soft mt-2">Massal impor orderan dari berkas Excel.</p>
            </div>

            <div className="card-box">
                <h2 className="card-title">Import langsung dari Excel Juli 2026</h2>
                <p className="text-soft">
                    Upload file <code>Rental Bulan Juli 2026.xlsx</code> sheet <b>Orderan</b>. Sistem membaca kolom
                    KETERANGAN s/d Status Unit (31 kolom), mapping otomatis ke form kita (Data Tamu internal, Upgrade,
                    Asal User, Panjar). Baris duplikat (pemesan+nopol+tgl_mulai) akan dilewati.
                </p>
                <form method="post" encType="multipart/form-data" action="/import/excel/simpan" className="mt-3">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label" htmlFor="xlsx">File Excel (.xlsx)</label>
                            <input type="file" id="xlsx" name="xlsx" accept=".xlsx,.xls" className="form-control" required />
                            <div className="form-text">Sheet: Orderan, header di baris 2, data mulai baris 4.</div>
                        </div>
                    </div>
                    <div className="baris-aksi mt-3">
                        <button type="submit" name="aksi_preview" value="1" className="btn btn-outline-secondary btn-sm">
                            Pratinjau 25 Baris
                        </button>
                    </div>
                </form>
            </div>

            {preview.length > 0 && (
                <div className="card-box">
                    <h3 className="card-title">
                        Pratinjau ({preview.length} baris pertama) &mdash; total terdeteksi {Number(ringkas.total)},
                        siap {Number(ringkas.siap)}, error {Number(ringkas.error)}
                    </h3>
                    <div className="table-wrap">
                        <table className="tabel kartu-hp">
                            <caption className="visually-hidden">Hasil impor Excel</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Row</th><th scope="col">Pemesan</th><th scope="col">Unit/Nopol</th><th scope="col">Asal User</th>
                                    <th scope="col">Mulai&ndash;Finish (hari)</th><th scope="col">Panjar</th><th scope="col">Total</th><th scope="col">Masalah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((pr) => (
                                    <tr key={pr.row}>
                                        <td data-label="Row">{Number(pr.row)}</td>
                                        <td data-label="Pemesan">
                                            {pr.pemesan}
                                            {pr.tamu !== "" && <div className="text-soft">Tamu: {pr.tamu}</div>}
                                        </td>
                                        <td data-label="Unit/Nopol">
                                            {pr.unit}
                                            <div className="mono">{pr.nopol}</div>
                                        </td>
                                        <td data-label="Asal User">{pr.asal}</td>
                                        <td data-label="Mulai–Finish">
                                            {pr.mulai ?? "-"} s/d {pr.finish ?? "-"} ({Number(pr.hari)}, excel {Number(pr.hariExcel)})
                                        </td>
                                        <td data-label="Panjar">{pr.panjar ? rupiah(pr.panjar) : "-"}</td>
                                        <td data-label="Total">{pr.total ? rupiah(pr.total) : "-"}</td>
                                        <td data-label="Masalah">{pr.masalah !== "" ? pr.masalah : "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <form
                        method="post"
                        action="/import/excel/simpan"
                        className="mt-3"
                        data-konfirmasi="Import semua baris yang terdeteksi? Duplikat akan dilewati."
                    >
                        <input type="hidden" name="file_token" value={token} />
                        <button type="submit" name="aksi_import" value="1" className="btn btn-primary btn-sm">
                            Import Sekarang ({Number(ringkas.total)} baris)
                        </button>
                        <span className="text-soft ms-2">File sudah disimpan sementara &mdash; tidak perlu upload ulang.</span>
                    </form>
                </div>
            )}

            {hasilImport && (
                <div className="card-box">
                    <h3 className="card-title">Hasil Import</h3>
                    <div className="alert alert-info">
                        Masuk: <b>{Number(hasilImport.masuk)}</b> &middot; Dilewati: {Number(hasilImport.lewati)} &middot;
                        Gagal: {Number(hasilImport.gagal)}
                    </div>
                    {hasilImport.log.length > 0 && (
                        <pre className="log-box">{hasilImport.log.join("\n")}</pre>
                    )}
                    <a className="btn btn-sm btn-outline-secondary mt-2" href="/pesanan">Lihat Data Pesanan</a>
                </div>
            )}

            <div className="card-box">
                <h3 className="card-title">Catatan mapping (best practice)</h3>
                <ul className="text-soft daftar-rapat">
                    <li><b>KETERANGAN</b> &rarr; <code>keterangan</code> (opsional, mis Ketua Apkasi)</li>
                    <li><b>Asal User</b> (RTR/Corp/RO/Apkasi/IG/Web/Bu Tika) &rarr; disimpan mentah di <code>asal_user_raw</code> + auto-map ke Tipe Pelanggan &amp; Sumber</li>
                    <li><b>Asal Unit</b> (Aksa/Kak Maria/Galih/1000 Rent) &rarr; <code>order_items.partner_id</code> (Support By per unit); 1000 Rent = armada sendiri</li>
                    <li><b>Upgrade</b> (Up Reborn etc) &rarr; <code>order_items.upgrade</code></li>
                    <li><b>Data Tamu</b> &rarr; <code>data_tamu</code> internal, tidak cetak invoice</li>
                    <li><b>Harga Jual &amp; Modal</b> &rarr; di Excel ada total &amp; per-hari campur; importer deteksi otomatis (jika Q*hari+tambahan &asymp; Total maka Q=per-hari, else Q=total/hari). Modal diambil dari TOTAL PENGELUARAN/hari.</li>
                    <li><b>Panjar</b> &rarr; <code>orders.panjar</code>; saat <b>Terbitkan Invoice</b> otomatis jadi pembayaran DP &mdash; tidak perlu input dua kali.</li>
                    <li><b>Status Bayar/Unit</b> &rarr; Lunas+Finish=paid, Cancel=batal, else completed (histori)</li>
                </ul>
            </div>
        </>
    );
}

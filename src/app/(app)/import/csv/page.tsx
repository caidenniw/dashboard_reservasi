import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { ambilFlash } from "@/lib/flash-server";
import type { FlashImportCsv } from "@/lib/import-server";

/*
 * Import CSV — port dari import/csv.blade.php + ImportController::csv (GET).
 * Hasil import dibaca dari flash `hasil_import` (dipasang route POST).
 */

const JENIS: Array<[string, string]> = [
    ["unit", "Unit / Mobil"],
    ["driver", "Driver"],
    ["customer", "Customer"],
    ["pesanan", "Pesanan + Invoice"],
];

const PILL_STATUS: Record<string, string> = {
    ok: "pill-green",
    lewati: "pill-slate",
    gagal: "pill-red",
};

export default async function HalamanImportCsv() {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "import")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Import CSV.</p>
            </div>
        );
    }

    const flash = (await ambilFlash()) as FlashImportCsv;
    const hasil = flash.hasil_import ?? [];

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sistem & Tools · Import</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Import CSV</h1>
                <p className="text-ink-soft mt-2">Impor data mentah dari ekspor CSV lama.</p>
            </div>

            <div className="card-box">
                <h2 className="card-title">Import dari CSV (hasil ekspor Google Sheet)</h2>
                <p className="text-soft">
                    Simpan sheet sebagai <b>CSV</b> (File &rarr; Download &rarr; Comma Separated Values).
                    Baris pertama harus nama kolom. Data yang sudah ada akan <b>dilewati</b>, tidak ditimpa dan tidak dihapus.
                    Setelah import, semua input dilakukan dari dashboard (sheet hanya cadangan).
                </p>
                <form method="post" encType="multipart/form-data" action="/import/csv/simpan">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label" htmlFor="jenis">Jenis data</label>
                            <select className="form-select form-select-sm" id="jenis" name="jenis" required>
                                {JENIS.map(([nilai, label]) => (
                                    <option key={nilai} value={nilai}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-5">
                            <label className="form-label" htmlFor="csv">File CSV</label>
                            <input type="file" className="form-control form-control-sm" id="csv" name="csv" accept=".csv,text/csv" required />
                        </div>
                    </div>
                    <div className="baris-aksi mt-3">
                        <button type="submit" className="btn btn-sm btn-primary">Import</button>
                        <a className="btn btn-sm btn-outline-secondary" href="/import/csv/template?jenis=unit">Template Unit</a>
                        <a className="btn btn-sm btn-outline-secondary" href="/import/csv/template?jenis=driver">Template Driver</a>
                        <a className="btn btn-sm btn-outline-secondary" href="/import/csv/template?jenis=pesanan">Template Pesanan</a>
                    </div>
                </form>
            </div>

            {hasil.length > 0 && (
                <div className="card-box">
                    <h2 className="card-title">Hasil import</h2>
                    <div className="table-wrap">
                        <table className="tabel kartu-hp">
                            <caption className="visually-hidden">Hasil impor CSV</caption>
                            <thead>
                                <tr><th scope="col">Baris</th><th scope="col">Status</th><th scope="col">Keterangan</th></tr>
                            </thead>
                            <tbody>
                                {hasil.map((h, i) => (
                                    <tr key={i}>
                                        <td data-label="Baris">{Number(h[0])}</td>
                                        <td data-label="Status">
                                            <span className={`badge-pill ${PILL_STATUS[h[1]] ?? "pill-slate"}`}>{h[1]}</span>
                                        </td>
                                        <td data-label="Keterangan">{h[2]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card-box">
                <h2 className="card-title">Nama kolom yang dikenali</h2>
                <dl className="dl-2">
                    <dt>Unit</dt><dd className="mono">nama_unit, nopol, kode_unit, jenis, tahun, transmisi, kapasitas, pemilik, harga_modal_default, harga_jual_default, status</dd>
                    <dt>Driver</dt><dd className="mono">nama, hp, wilayah, nomor_sim, bank, no_rekening, status</dd>
                    <dt>Customer</dt><dd className="mono">nama_pesanan, tipe, nama_pic, hp_pic, email, alamat, sumber, status</dd>
                    <dt>Pesanan</dt><dd className="mono">nama_pesanan, nama_pic, hp_pic, kota, wilayah_pelayanan, tgl_mulai, tgl_finish, jam, standby_point, flight, unit, nopol, driver, harga_modal_per_hari, harga_jual_per_hari, include, status, catatan</dd>
                </dl>
                <div className="form-text">
                    Tanggal boleh format <span className="mono">2026-09-27</span> atau <span className="mono">27/09/2026</span>.
                    Pemisah kolom koma atau titik koma, keduanya dibaca.
                </div>
            </div>
        </>
    );
}

import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { daftarSetting } from "@/lib/settings";

/*
 * Pengaturan Faktur — port dari pengaturan/index.blade.php + PengaturanController.
 */

const JUDUL_GRUP: Record<string, string> = {
    kop: "Kop Invoice & Identitas",
    bayar: "Pembayaran & DP",
    nomor: "Format Nomor Dokumen",
};

/* Field berisi teks banyak wajib textarea, bukan input satu baris. */
const PAKAI_TEXTAREA = ["footer_invoice", "tagline", "catatan_bank", "daftar_bank"];

export default async function HalamanPengaturan() {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "pengaturan")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Pengaturan Faktur.</p>
            </div>
        );
    }

    const rows = await daftarSetting();
    const grup: Record<string, typeof rows> = {};
    for (const r of rows) {
        (grup[r.grup] ??= []).push(r);
    }

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sistem & Tools · Faktur</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Pengaturan Faktur</h1>
                <p className="text-ink-soft mt-2">Nomor, kop, dan format invoice perusahaan.</p>
            </div>

        <form method="post" action="/pengaturan/simpan">
            {Object.entries(grup).map(([nama, items]) => (
                <div className="card-box" key={nama}>
                    <h2 className="card-title">{JUDUL_GRUP[nama] ?? (nama.charAt(0).toUpperCase() + nama.slice(1))}</h2>
                    <div className="form-grid">
                        {items.map((s) => {
                            const textarea = PAKAI_TEXTAREA.includes(s.key);
                            return (
                                <div className={textarea ? "full" : ""} key={s.key}>
                                    <label className="form-label" htmlFor={`s_${s.key}`}>
                                        {s.label || s.key}
                                    </label>
                                    {textarea ? (
                                        <textarea
                                            className="form-control"
                                            id={`s_${s.key}`}
                                            name={s.key}
                                            rows={3}
                                            defaultValue={s.value ?? ""}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-control"
                                            id={`s_${s.key}`}
                                            name={s.key}
                                            defaultValue={s.value ?? ""}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            <div className="card-box">
                <button type="submit" className="btn btn-primary btn-sm">Simpan Pengaturan</button>
            </div>
        </form>
        </>
    );
}

import { harusMasuk } from "@/lib/sesi";
import { roleBoleh } from "@/lib/akses";
import { siap, tokenUntuk } from "@/lib/asisten-server";
import { SkripMuat } from "@/components/skrip-muat";

/* Halaman ini hanya menampilkan percakapan; endpoint /api/asisten tidak menyimpan data. */

const SKRIP_ASISTEN = ["/assets/js/asisten.js?v=20261005f"];

export default async function HalamanAsisten() {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "asisten")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak membuka Asisten Data.</p>
            </div>
        );
    }

    const aktif = siap();
    /* Blade memakai url('/') sebagai basis; satu origin cukup sehingga path relatif. */
    const basis = "";
    const token = tokenUntuk(user.id);

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sistem & Tools</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Asisten Data</h1>
                <p className="text-ink-soft mt-2">Ekstrak data pesanan dari teks bebas secara otomatis.</p>
            </div>

            {!aktif ? (
                <div className="alert alert-warning">
                    Asisten AI belum aktif. Fitur ini akan segera hadir.
                </div>
            ) : (
                <>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window.RN_ASISTEN = { base: ${JSON.stringify(basis)}, token: ${JSON.stringify(token)} };`,
                        }}
                    />

                    <div className="rna-page">
                        <div className="card-box">
                            <h2 className="card-title">Tanya data dashboard</h2>
                            <p className="text-soft mb-3">
                                Ajukan pertanyaan dengan bahasa sehari-hari. Asisten menjawab dari data asli sistem
                                (pesanan, invoice, unit, driver). Asisten <b>hanya membaca</b> &mdash; tidak bisa
                                membuat, mengubah, atau menghapus data.
                            </p>

                            <div className="rna-chat" data-rna-root data-rna-saran="1">
                                <div className="rna-body" data-rna-body aria-live="polite" />
                                <form className="rna-form" data-rna-form>
                                    <label className="visually-hidden" htmlFor="rna-input-halaman">Pertanyaan untuk asisten</label>
                                    <textarea
                                        className="rna-input"
                                        id="rna-input-halaman"
                                        data-rna-input
                                        rows={2}
                                        placeholder="Contoh: invoice mana yang belum lunas? / pesanan hari ini apa saja?"
                                    />
                                    <button className="rna-send" data-rna-send type="submit">
                                        Kirim
                                    </button>
                                </form>
                            </div>

                            <div className="rna-note mt-2">
                                Asisten hanya membaca data sistem &mdash; tidak bisa membuat, mengubah, atau menghapus
                                apa pun. Tulis pertanyaan seperti kamu bertanya ke rekan kerja. Kalau datanya tidak ada,
                                asisten akan bilang tidak ada dan menunjukkan menu yang tepat untuk mencarinya.
                            </div>
                        </div>
                    </div>

                    <SkripMuat daftar={SKRIP_ASISTEN} />
                </>
            )}
        </>
    );
}

import type { Role } from "@/lib/akses";
import { pathPermintaan } from "@/lib/path";
import { roleBoleh } from "@/lib/akses";
import { siap, tokenUntuk } from "@/lib/asisten-server";
import { userPermintaan } from "@/lib/sesi";
import { SkripMuat } from "@/components/skrip-muat";

/*
 * Widget asisten mengambang (#rnaPanel) — port PERSIS dari
 * legacy-laravel/resources/views/partials/asisten_widget.blade.php.
 *
 * Muncul untuk peran berhak 'asisten' di SEMUA halaman dashboard, kecuali di
 * halaman /asisten sendiri supaya tidak dobel. Angka margin/laba tetap difilter
 * di server (lihat rekapBulanan di asisten-server), jadi peran tanpa
 * lihat_modal tidak melihat margin.
 *
 * Token HMAC stabil per user disuntik dari tokenUntuk(user.id).
 */
const SKRIP_ASISTEN = ["/assets/js/asisten.js?v=20261005f"];
export async function WidgetAsisten({ role }: { role: Role }) {
    /* Penyaring cepat dari shell; sesi diverifikasi ulang di bawah. */
    if (!roleBoleh(role, "asisten") || !siap()) {
        return null;
    }
    const user = await userPermintaan();
    if (!user || !roleBoleh(user.role, "asisten") || !siap()) {
        return null;
    }
    if ((await pathPermintaan()).startsWith("/asisten")) {
        return null;
    }
    /* Partial Blade memakai url('/') sebagai basis; satu origin cukup sehingga path relatif. */
    const basis = "";
    const token = tokenUntuk(user.id);

    return (
        <>
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.RN_ASISTEN = { base: ${JSON.stringify(basis)}, token: ${JSON.stringify(token)} };`,
                }}
            />

            <button
                type="button"
                className="rna-btn"
                id="rnaTombol"
                aria-label="Buka asisten data"
                aria-expanded="false"
                aria-controls="rnaPanel"
                title="Asisten data"
            >
                <svg
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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="13" x2="13" y2="13" />
                </svg>
                <span>Asisten</span>
            </button>

            <div
                className="rna-panel"
                id="rnaPanel"
                role="dialog"
                aria-label="Asisten data dashboard"
                aria-modal="true"
                tabIndex={-1}
                data-rna-root
                data-rna-buka="rnaPanel"
                data-rna-pemicu="rnaTombol"
                data-rna-saran="1"
            >
                <div className="rna-head">
                    <div className="rna-head-info">
                        <span className="rna-head-ikon" aria-hidden="true">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                <line x1="9" y1="9" x2="15" y2="9" />
                                <line x1="9" y1="13" x2="13" y2="13" />
                            </svg>
                        </span>
                        <div>
                            <div className="rna-head-t">Asisten Dashboard</div>
                            <div className="rna-head-s">Baca data pesanan, invoice, unit &amp; driver. Tidak bisa mengubah data.</div>
                        </div>
                    </div>
                    <button type="button" className="rna-x" aria-label="Tutup">
                        &times;
                    </button>
                </div>
                <div className="rna-body" data-rna-body aria-live="polite" />
                <form className="rna-form" data-rna-form>
                    <label className="visually-hidden" htmlFor="rna-input-widget">Pertanyaan untuk asisten</label>
                    <textarea
                        className="rna-input"
                        id="rna-input-widget"
                        data-rna-input
                        rows={1}
                        placeholder="Tulis pertanyaan, mis: invoice mana yang belum lunas?"
                    />
                    <button className="rna-send" data-rna-send type="submit">
                        Kirim
                    </button>
                </form>
            </div>

            <SkripMuat daftar={SKRIP_ASISTEN} />
        </>
    );
}

/*
 * Modal konfirmasi generik — port dari #rnKonfirmasi di layouts/app.blade.php.
 * Struktur & id dipertahankan (kontrak DOM). Buka/tutup via <dialog> native
 * (app.js memanggil showModal/close); tidak butuh Bootstrap JS lagi.
 */
export function ModalKonfirmasi() {
    return (
        <dialog className="rn-modal rn-dialog" id="rnKonfirmasi" aria-labelledby="rnKonfirmasiJudul" aria-describedby="rnKonfirmasiPesan rnKonfirmasiKonteks">
            <div className="rn-modal-body">
                <div className="rn-modal-ikon" id="rnKonfirmasiIkon" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div className="rn-modal-teks">
                    <div className="rn-modal-judul" id="rnKonfirmasiJudul">Konfirmasi</div>
                    <p className="rn-modal-pesan" id="rnKonfirmasiPesan" />
                    <p className="rn-modal-konteks" id="rnKonfirmasiKonteks" />
                </div>
            </div>
            <div className="modal-footer rn-modal-footer">
                <button type="button" className="btn btn-outline-secondary" id="rnKonfirmasiBatal">Batal</button>
                <button type="button" className="btn" id="rnKonfirmasiYa">Ya, lanjutkan</button>
            </div>
        </dialog>
    );
}

"use client";

/*
 * Tombol "Salin Teks" untuk halaman Teks WA.
 *
 * Memanggil rnSalin() yang sudah ada di public/assets/js/app.js (dipakai ulang
 * apa adanya, tidak diubah) supaya perilaku tombol sama persis dengan halaman
 * lama — termasuk efek sementara pada label tombol.
 */
export function TombolSalin({ idTeks, idTombol }: { idTeks: string; idTombol: string }) {
    return (
        <button
            type="button"
            className="btn btn-sm btn-primary"
            id={idTombol}
            onClick={() => {
                const w = window as unknown as { rnSalin?: (a: string, b: string) => void };
                if (typeof w.rnSalin === "function") {
                    w.rnSalin(idTeks, idTombol);
                    return;
                }
                /* Cadangan bila app.js belum termuat: salin manual lalu beri umpan balik. */
                const el = document.getElementById(idTeks) as HTMLTextAreaElement | null;
                if (!el) {
                    return;
                }
                el.select();
                void navigator.clipboard?.writeText(el.value);
            }}
        >
            Salin Teks
        </button>
    );
}

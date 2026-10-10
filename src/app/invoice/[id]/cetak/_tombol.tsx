"use client";

/*
 * Tombol toolbar halaman cetak invoice.
 *
 * Di Blade tombol-tombol ini memakai atribut `onclick="window.print()"` inline.
 * React tidak mengizinkan handler event dari Server Component, jadi bagian kecil
 * ini dijadikan Client Component — markup & class-nya SAMA seperti Blade
 * (.cetak/.abu untuk template klasik, .print-bar/.btn-print/.btn-back untuk modern).
 */

export function TombolCetakKlasik() {
    return (
        <button className="cetak" onClick={() => window.print()}>
            Print / Simpan PDF
        </button>
    );
}

export function ToolbarModern() {
    return (
        <div className="print-bar no-print">
            <button className="btn-print" onClick={() => window.print()}>
                Print / Save PDF
            </button>
            <button
                className="btn-back"
                onClick={(e) => {
                    window.close();
                    /* Tab biasa menolak close tanpa pesan — sembunyikan tombol
                       supaya tidak terlihat mati (bukan popup: tak bisa kembali). */
                    e.currentTarget.style.display = "none";
                }}
            >
                Kembali
            </button>
            <span className="hint">Template: Modern 1000 &mdash; tekan Ctrl+P untuk mencetak</span>
        </div>
    );
}

"use client";

/*
 * Balasan cepat untuk halaman Teks WA — sisipkan template pesan ke textarea
 * `#teksWa` tanpa menghapus isi yang sudah ada. Template bawaan; kalau nanti
 * perlu dikelola user, simpan di tabel `settings` (tanpa DDL).
 */
const BALASAN: Array<{ label: string; teks: string }> = [
    {
        label: "Konfirmasi pesanan diterima",
        teks: "Halo Bapak/Ibu, pesanan Anda sudah kami terima dan sedang kami proses. Detail unit & driver akan dikonfirmasi kembali menjelang hari pelaksanaan. Terima kasih.",
    },
    {
        label: "Pengingat H-1",
        teks: "Halo Bapak/Ibu, mengingatkan besok Anda akan menggunakan jasa sewa kami. Mohon info titik jemput dan jam koordinasi driver. Terima kasih.",
    },
    {
        label: "Pengingat pembayaran",
        teks: "Halo Bapak/Ibu, mohon info untuk pelunasan pembayaran sesuai nominal dan rekening pada invoice yang sudah dikirim. Jika sudah transfer, mohon kirim buktinya ke kami. Terima kasih.",
    },
    {
        label: "Terima kasih setelah selesai",
        teks: "Terima kasih sudah menggunakan jasa sewa kami. Ada hal yang bisa kami bantu lagi untuk perjalanan berikutnya? Kami siap 24 jam.",
    },
];

export function BalasanCepat({
    idTeks,
    daftar,
}: {
    idTeks: string;
    daftar?: Array<{ label: string; teks: string }>;
}) {
    /* Sumber opsi: template tersimpan di settings `wa_balasan`, fallback ke
       template bawaan bila belum diisi (value '[]' / kosong / rusak). */
    const opsi = daftar && daftar.length > 0 ? daftar : BALASAN;
    return (
        <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-medium text-ink-soft">Balasan cepat:</span>
            <select
                className="min-w-60 max-w-full px-2 py-1 text-xs rounded-lg border border-line-strong bg-surface text-ink-soft outline-none focus:ring-2 focus:ring-primary"
                defaultValue=""
                aria-label="Pilih balasan cepat"
                onChange={(e) => {
                    const idx = Number(e.target.value);
                    const teks = opsi[idx]?.teks;
                    const ta = document.getElementById(idTeks) as HTMLTextAreaElement | null;
                    if (teks && ta) {
                        const dasar = ta.value.replace(/\s+$/, "");
                        ta.value = dasar ? dasar + "\n\n" + teks : teks;
                        ta.focus();
                        ta.setSelectionRange(ta.value.length, ta.value.length);
                    }
                    e.target.value = "";
                }}
            >
                <option value="">— pilih template —</option>
                {opsi.map((b, i) => (
                    <option key={b.label} value={i}>{b.label}</option>
                ))}
            </select>
        </div>
    );
}

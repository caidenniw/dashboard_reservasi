/*
 * CSS halaman cetak invoice klasik — legacy-laravel/resources/views/invoice/cetak.blade.php
 * SALINAN APA ADANYA; hanya selektor yang berakar pada <body> yang dipindahkan
 * ke pembungkus `.inv-root`, karena di Next.js halaman tidak boleh menulis
 * atribut <body> (root layout yang memiliki elemen itu):
 *   body.embed …           -> .inv-root.embed …
 *   body:not(.embed) …     -> .inv-root:not(.embed) …
 * Aturan `body { … }` sengaja DIBIARKAN apa adanya supaya latar halaman &
 * tipografi hasil cetak tetap sama seperti Laravel.
 * `.inv-root.embed` juga diberi `min-height: 100vh` agar latar putih menutup
 * seluruh iframe pratinjau (di Laravel, latar itu milik <body>).
 *
 * JANGAN mengubah isi CSS ini selain penerjemahan di atas.
 */
export const CSS_KLASIK = String.raw`
    @page { size: A4 portrait; margin: 15mm 20mm 15mm 20mm; }

    /* Token lokal (halaman ini mandiri — tanpa CSS framework eksternal). */
    :root {
        --inv-gold: var(--accent-gold, #FFC000);      /* kop & baris total — identitas 1000 Nusantara (kertas) */
        --inv-maroon: var(--primary-fill, #d81f26);    /* merah tua brand dashboard */
        --inv-ink: #111;          /* teks utama */
        --inv-rule: #000;         /* garis tabel */
        --inv-muted: #444;        /* label sekunder */
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Aptos Narrow', 'Segoe UI', Calibri, Arial, sans-serif;
        font-size: 11pt; line-height: 1.4; color: var(--inv-ink); background: #e0e0e0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
    .invoice-page {
        width: 210mm; min-height: 297mm; margin: 10mm auto;
        background: #fff; padding: 18mm 20mm; box-shadow: 0 0 15px rgba(0,0,0,.15); position: relative;
    }

    /* ===== TOOLBAR LAYAR (tidak ikut tercetak) ===== */
    .no-print { max-width: 210mm; margin: 14px auto 0; display: flex; gap: 10px; flex-wrap: wrap; }
    .no-print button, .no-print a {
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; padding: 8px 16px;
        border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: 600; text-align: center;
    }
    .no-print .cetak { background: var(--inv-gold); color: #000; }
    .no-print .abu { background: #555; color: #fff; }

    /* ===== CETAK ===== */
    @media print {
        body { background: #fff; }
        .invoice-page { margin: 0; padding: 0; box-shadow: none; width: 100%; min-height: auto; }
        .no-print { display: none !important; }
        .main-table thead th { background: var(--inv-gold) !important; }
        .main-table tfoot tr:last-child td { background: var(--inv-gold) !important; }
    }

    /* ===== PRATINJAU DALAM IFRAME (?embed=1) ===== */
    .inv-root.embed { min-height: 100vh; background: #fff; overflow: auto; }
    .inv-root.embed .no-print { display: none !important; }
    /* Tanpa zoom: .55 mengecilkan teks di bawah skala baca & blur pinch-zoom.
       Konten melebihi lebar iframe -> geser horizontal, bukan zoom. */
    .inv-root.embed .invoice-page { width: 100%; min-height: 0; margin: 0; box-shadow: none; padding: 5mm 6mm; }

    /* ===== TAMPILAN HP ===== */
    @media screen and (max-width: 768px) {
        .inv-root:not(.embed) { padding: 10px 8px; }
        .inv-root:not(.embed) .invoice-page {
            width: 100%; min-height: auto; margin: 8px auto; padding: 12px 10px;
            box-shadow: 0 1px 6px rgba(0,0,0,.1);
        }
        .inv-root:not(.embed) .no-print { max-width: 100%; margin: 6px auto; gap: 6px; }
        .inv-root:not(.embed) .no-print button, .inv-root:not(.embed) .no-print a {
            flex: 1 1 auto; text-align: center; padding: 7px 10px; font-size: 11.5px;
        }
        .inv-root:not(.embed) .header { flex-direction: column; gap: 8px; padding-bottom: 6px; }
        .inv-root:not(.embed) .header-left { flex: none; }
        .inv-root:not(.embed) .header-right { text-align: left; }
        .inv-root:not(.embed) .info-section { flex-direction: column; }
        .inv-root:not(.embed) .info-left { flex: none; width: 100%; border-right: 1px solid var(--inv-rule); border-bottom: 0; }
        .inv-root:not(.embed) .main-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .inv-root:not(.embed) .footer { flex-direction: column; gap: 16px; }
        .inv-root:not(.embed) .footer-left { flex: none; width: 100%; }
    }

    /* ===== KOP ===== */
    .header {
        display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
        margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--inv-gold);
    }
    .header-left { flex: 1; }
    .header-left img { max-height: 55px; max-width: 187px; }
    .header-right { text-align: right; }
    .header-right .invoice-title { font-size: 24pt; font-weight: 700; letter-spacing: 3px; line-height: 1; }
    .header-right .company-name { font-size: 12pt; font-weight: 700; margin-top: 5px; }
    .header-right .company-info { font-size: 9pt; margin-top: 2px; line-height: 1.45; color: var(--inv-muted); }

    /* ===== IDENTITAS ===== */
    .info-section { display: flex; margin-bottom: 12px; }
    .info-left, .info-right { border: 1px solid var(--inv-rule); padding: 8px 10px; }
    .info-left { flex: 0 0 46%; border-right: 0; }
    .info-right { flex: 1; }
    .info-left .label { font-weight: 700; font-size: 9.5pt; letter-spacing: 1px; color: var(--inv-muted); margin-bottom: 4px; }
    .info-left .client-name { font-weight: 700; font-size: 14pt; line-height: 1.3; }
    .info-right table { width: 100%; border-collapse: collapse; }
    .info-right td { padding: 2.5px 0; font-size: 11pt; vertical-align: top; }
    .info-right td:first-child { font-weight: 700; width: 34%; color: var(--inv-muted); }
    .info-right td.colon { width: 5%; text-align: center; font-weight: 700; }
    /* Nilai seperti nomor faktur tidak boleh patah di tengah token. */
    .info-right td:last-child { font-weight: 700; white-space: nowrap; }
    .info-right tr:first-child td:last-child { font-size: 12pt; letter-spacing: .4px; }

    /* ===== TABEL ITEM ===== */
    .main-table { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
    .main-table thead { display: table-header-group; }
    .main-table thead th {
        background: var(--inv-gold) !important; font-weight: 700; font-size: 10pt;
        padding: 6px 5px; line-height: 1.2; border: 1px solid var(--inv-rule);
        text-align: center; vertical-align: middle;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .main-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .main-table tbody td {
        border-left: 1px solid var(--inv-rule); border-right: 1px solid var(--inv-rule);
        padding: 5px 6px; vertical-align: top; line-height: 1.35; overflow-wrap: break-word;
    }
    .main-table tbody tr.data-row td { border-bottom: none; border-top: none; }
    .main-table tbody tr.empty-row td { height: 20px; }
    .main-table .col-no { text-align: center; width: 22px; }
    .main-table .col-ket { width: auto; }
    /* Kolom sempit dirapatkan dan kolom uang dilonggarkan supaya nominal
       tidak terbelah; sisa lebar diambil kolom keterangan (auto). */
    .main-table .col-driver { width: 72px; }
    .main-table .col-tgl { width: 56px; }
    .main-table .col-rute { width: 80px; }
    /* Lebar kolom uang harus cukup untuk "Rp 1.200.000" dalam satu baris;
       tanpa nowrap, "Rp" terpisah dari angkanya (nilai terbaca salah). */
    .main-table .col-harga { text-align: right; width: 92px; }
    .main-table .col-modal { text-align: right; width: 78px; }
    .main-table .col-hari { text-align: center; width: 46px; font-variant-numeric: tabular-nums; }
    .main-table .col-total { text-align: right; width: 104px; }
    .main-table .col-harga, .main-table .col-modal, .main-table .col-total { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .main-table tbody tr.separator td { border-top: 1px solid var(--inv-rule); }

    .main-table tfoot tr { break-inside: avoid; page-break-inside: avoid; }
    .main-table tfoot td { border: 1px solid var(--inv-rule); padding: 5px 6px; font-size: 10pt; font-weight: 700; }
    .main-table tfoot .label-cell { text-align: center; }
    .main-table tfoot .hari-cell { text-align: center; }
    .main-table tfoot .amount-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .main-table tfoot tr:last-child td {
        background: var(--inv-gold) !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }

    /* ===== TERBILANG ===== */
    .terbilang { margin-top: 8px; font-size: 10pt; font-weight: 700; font-style: italic; }

    /* ===== CATATAN & TANDA TANGAN ===== */
    .footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 24px; }
    .footer-left { flex: 0 0 46%; border: 1px solid var(--inv-rule); padding: 8px 10px; font-size: 10.5pt; font-weight: 700; line-height: 1.5; }
    .footer-left .catatan-title { font-weight: 700; margin-bottom: 3px; letter-spacing: .5px; }
    .footer-right { text-align: center; font-size: 11pt; padding-top: 4px; }
    .footer-right .hormat { font-weight: 700; margin-bottom: 4px; }
    .footer-right .company { font-weight: 700; }
    .footer-right .ttd-space { height: 55px; display: flex; align-items: center; justify-content: center; }
    .footer-right .ttd-space img { max-height: 55px; }
    .footer-right .nama { font-weight: 700; }

    /* ===== LEMBAR INTERNAL ===== */
    .internal-box { border: 1px solid var(--inv-rule); padding: 8px 10px; margin-top: 10px; font-size: 10.5pt; }
    .internal-box table { width: 100%; border-collapse: collapse; }
    .internal-box td { padding: 2.5px 0; vertical-align: top; }
    .internal-box td:first-child { color: var(--inv-muted); }
    .internal-box td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .tanda-internal {
        text-align: center; font-size: 11pt; font-weight: 700; color: var(--inv-maroon);
        letter-spacing: 1px; border: 2px solid var(--inv-maroon); padding: 4px 8px; margin: 0 0 10px;
    }
    .watermark {
        position: absolute; top: 45%; left: 0; right: 0; text-align: center;
        font-size: 84pt; font-weight: 700; color: rgba(216,31,38,.13);
        transform: rotate(-18deg); letter-spacing: 8px; z-index: 0;
    }
`;

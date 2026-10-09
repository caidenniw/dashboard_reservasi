/*
 * CSS halaman cetak invoice modern — legacy-laravel/resources/views/invoice/cetak_modern.blade.php
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
export const CSS_MODERN = String.raw`
        @page { size: A4 portrait; margin: 15mm 20mm 15mm 20mm; }

        /* Token lokal — disamakan dengan template klasik (halaman ini mandiri,
           tanpa CSS framework eksternal). */
        :root {
            --inv-gold: var(--accent-gold, #FFC000);      /* kop & baris total — identitas 1000 Nusantara (kertas) */
            --inv-maroon: var(--primary-fill, #d81f26);    /* merah tua brand dashboard */
            --inv-ink: #111;          /* teks utama */
            --inv-rule: #000;         /* garis tabel */
            --inv-muted: #444;        /* label sekunder */
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Calibri, 'Segoe UI', Arial, sans-serif;
            font-size: 11pt; line-height: 1.4; color: var(--inv-ink); background: #e0e0e0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        .invoice-page {
            width: 210mm; min-height: 297mm; margin: 10mm auto; background: #fff;
            padding: 18mm 20mm; box-shadow: 0 0 15px rgba(0,0,0,.15); position: relative;
        }

        /* ===== CETAK ===== */
        @media print {
            body { background: #fff; }
            .invoice-page { margin: 0; padding: 0; box-shadow: none; width: 100%; min-height: auto; }
            .no-print { display: none !important; }
            .main-table thead th { background: var(--inv-gold) !important; }
            .main-table tfoot tr:last-child td { background: var(--inv-gold) !important; }
        }

        /* ===== PRATINJAU DALAM IFRAME (?embed=1) ===== */
        .inv-root.embed { min-height: 100vh; background: #fff; }
        .inv-root.embed .no-print { display: none !important; }
        .inv-root.embed .invoice-page { width: 100%; min-height: 0; margin: 0; box-shadow: none; padding: 5mm 6mm; zoom: .55; }

        /* ===== TAMPILAN HP ===== */
        @media screen and (max-width: 768px) {
            .inv-root:not(.embed) { padding: 56px 8px 10px; }
            .inv-root:not(.embed) .invoice-page {
                width: 100%; min-height: auto; margin: 8px auto; padding: 12px 10px;
                box-shadow: 0 1px 6px rgba(0,0,0,.1);
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
        .info-right table td { padding: 2.5px 0; font-size: 11pt; vertical-align: top; }
        .info-right table td:first-child { font-weight: 700; width: 34%; color: var(--inv-muted); }
        .info-right table td.colon { width: 5%; text-align: center; font-weight: 700; }
        /* Nilai seperti nomor faktur tidak boleh patah di tengah token. */
        .info-right table td:last-child { font-weight: 700; white-space: nowrap; }
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

        .main-table tfoot tr { break-inside: avoid; page-break-inside: avoid; }
        .main-table tfoot td { border: 1px solid var(--inv-rule); padding: 5px 6px; font-size: 10pt; font-weight: 700; }
        .main-table tfoot .label-cell { text-align: center; font-weight: 700; }
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
        .footer-right .ttd-space { height: 55px; }
        .footer-right .nama { font-weight: 700; font-size: 11pt; }
        .footer-right .company { font-weight: 700; font-size: 11pt; }

        /* ===== LEMBAR INTERNAL ===== */
        .internal-box { margin-top: 10px; border: 1px solid var(--inv-rule); padding: 8px 10px; font-size: 10.5pt; }
        .internal-box table { width: 100%; border-collapse: collapse; }
        .internal-box td { padding: 2.5px 0; vertical-align: top; }
        .internal-box td:first-child { color: var(--inv-muted); }
        .internal-box td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .tanda-internal {
            margin: 0 0 10px; border: 2px solid var(--inv-maroon); color: var(--inv-maroon);
            font-weight: 700; text-align: center; padding: 4px 8px; letter-spacing: 1px;
        }
        .watermark {
            position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg);
            font-size: 110pt; font-weight: 900; color: rgba(216,31,38,.12); letter-spacing: 8px; z-index: 0;
        }

        /* ===== TOOLBAR LAYAR (tidak ikut tercetak) ===== */
        .print-bar {
            position: fixed; top: 0; left: 0; right: 0; background: #333; color: #fff;
            padding: 10px 20px; display: flex; gap: 12px; align-items: center; z-index: var(--z-sticky);
        }
        .print-bar button { padding: 8px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; }
        .btn-print { background: var(--inv-gold); color: #000; }
        .btn-back { background: #666; color: #fff; }
        .print-bar .hint { margin-left: auto; font-size: 13px; opacity: .7; }

        /* ===== TAMBAHAN PORT NEXT (tidak ada di Blade) =====
           Halaman cetak Next tetap memuat CSS dasar aplikasi (lintas root
           layout), sedangkan halaman Blade mandiri hanya memuat CSS cetak.
           Agar tombol toolbar di sini berukuran sama dengan versi Blade
           (148x32 px), dua properti ini dipin ke nilai bawaan browser lewat
           kata kunci revert. Dibatasi ke .print-bar button supaya aturan
           cetak lain tidak tertimpa. */
        .print-bar button { font-family: revert; line-height: revert; }
    `;

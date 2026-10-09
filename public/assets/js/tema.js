/* Tema terang/gelap untuk Dashboard Reservasi.
   Sumber tunggal warna bagi grafik & skrip lain.

   NILAI WAJIB HEX di app.css: Chart.js memakai @kurkle/color yang tidak
   mendukung oklch(), jadi warna oklch akan gagal dirender ke canvas. */
window.RNTema = (function () {
    var KUNCI = 'rn_theme';

    /* getComputedStyle mengembalikan custom property dengan spasi di depan
       (mis. " #d81f26"). Tanpa .trim() warna canvas jadi tidak valid. */
    function warna(nama, cadangan) {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue(nama);
            v = (v || '').trim();
            return v || (cadangan || '');
        } catch (e) {
            return cadangan || '';
        }
    }

    /* Palet kategorikal grafik, dibaca dari token --chart-1..12. */
    function palet() {
        var arr = [];
        for (var i = 1; i <= 12; i++) arr.push(warna('--chart-' + i));
        return arr;
    }

    function mode() {
        return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
    }

    function pasang(m) {
        var baru = (m === 'dark') ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', baru);
        try { localStorage.setItem(KUNCI, baru); } catch (e) {}
        document.dispatchEvent(new CustomEvent('rn:themechange', { detail: { mode: baru } }));
    }

    function ganti() {
        pasang(mode() === 'dark' ? 'light' : 'dark');
    }

    /* Ikuti perubahan tema OS hanya bila pengguna belum memilih manual. */
    try {
        if (window.matchMedia) {
            var mq = matchMedia('(prefers-color-scheme: dark)');
            var ikut = function () {
                var tersimpan = null;
                try { tersimpan = localStorage.getItem(KUNCI); } catch (e) {}
                if (tersimpan !== 'dark' && tersimpan !== 'light') {
                    document.documentElement.setAttribute('data-bs-theme', mq.matches ? 'dark' : 'light');
                    document.dispatchEvent(new CustomEvent('rn:themechange', { detail: { mode: mode() } }));
                }
            };
            if (mq.addEventListener) mq.addEventListener('change', ikut);
            else if (mq.addListener) mq.addListener(ikut);
        }
    } catch (e) {}

    /* Utilitas bersama grafik: jadikan warna solid jadi rgba dengan alpha. */
    function alfa(hex, a) {
        var h = (hex || '').trim().replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        if (isNaN(n) || h.length !== 6) return hex;
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    return { warna: warna, palet: palet, mode: mode, pasang: pasang, ganti: ganti, alfa: alfa, KUNCI: KUNCI };
})();

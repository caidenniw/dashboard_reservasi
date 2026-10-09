/* Pertahankan posisi scroll saat halaman memuat ulang karena filter / pindah
   halaman / paginasi (navigasi GET pada halaman yang sama), supaya tidak
   lompat balik ke atas. Aksi form POST (simpan/invoice/bayar) TIDAK dipertahankan
   — itu memang lebih baik dibuka dari atas supaya pesan konfirmasi terlihat.

   Dua sumbu disimpan terpisah: posisi vertikal jendela, dan geseran samping tiap
   papan kalender (.kal-wrap, ber-overflow-x) supaya kolom yang sedang dilihat
   tidak balik ke paling kiri setelah halaman dimuat ulang. */
(function () {
    'use strict';

    if ('scrollRestoration' in history) {
        try { history.scrollRestoration = 'manual'; } catch (e) {}
    }

    var key = 'rn_scroll:' + location.pathname;
    /* geseran horizontal tiap .kal-wrap, urut dokumen (papan unit, lalu driver) */
    var keyH = 'rn_scroll_h:' + location.pathname;

    function papan() {
        return document.querySelectorAll('.kal-wrap');
    }

    function simpan() {
        try {
            sessionStorage.setItem(key, String(window.scrollY || window.pageYOffset || 0));
            var p = papan();
            var kiri = [];
            for (var i = 0; i < p.length; i++) kiri.push(p[i].scrollLeft);
            sessionStorage.setItem(keyH, JSON.stringify(kiri));
        } catch (e) {}
    }

    function pulihkan() {
        try {
            var v = sessionStorage.getItem(key);
            if (v !== null) {
                /* Pemulihan posisi harus instan. `html { scroll-behavior: smooth }`
                   (app.css) membuat window.scrollTo ikut dianimasikan, sehingga
                   halaman terlihat meluncur dari atas. Matikan sebentar lewat inline
                   style (menang atas stylesheet), lalu kembalikan nilai semula. */
                var html = document.documentElement;
                var semula = html.style.scrollBehavior;
                html.style.scrollBehavior = 'auto';
                try { window.scrollTo(0, parseInt(v, 10) || 0); }
                finally { html.style.scrollBehavior = semula; }
                sessionStorage.removeItem(key);
            }

            /* geseran samping tiap papan kalender */
            var kiri = sessionStorage.getItem(keyH);
            if (kiri !== null) {
                kiri = JSON.parse(kiri) || [];
                var p = papan();
                for (var i = 0; i < p.length && i < kiri.length; i++) {
                    var semulaH = p[i].style.scrollBehavior;
                    p[i].style.scrollBehavior = 'auto';
                    p[i].scrollLeft = parseInt(kiri[i], 10) || 0;
                    p[i].style.scrollBehavior = semulaH;
                }
                sessionStorage.removeItem(keyH);
            }
        } catch (e) {}
        /* tampilkan kembali halaman (disembunyikan sementara di <head> supaya
           tidak flash ke atas sebelum posisi scroll dipulihkan) */
        try { document.documentElement.classList.remove('rn-restore'); } catch (e2) {}
    }

    function halamanSama(href) {
        if (!href || href.charAt(0) === '#') return false;
        var a = document.createElement('a');
        a.href = href;
        return a.pathname === location.pathname;
    }

    /* form filter (GET) -> simpan posisi sebelum halaman dimuat ulang */
    document.addEventListener('submit', function (e) {
        var f = e.target;
        if (f && f.tagName === 'FORM' && String(f.method || 'get').toLowerCase() === 'get') {
            simpan();
        }
    }, true);

    /* tautan pada halaman yang sama (filter, paginasi, ganti periode) -> simpan.
       Lewati klik yang tidak menavigasi di tab ini (tombol pengubah, tab baru)
       supaya posisi yang tersimpan tidak basi untuk pemuatan berikutnya. */
    document.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== document && t.tagName !== 'A') t = t.parentNode;
        if (t && t.tagName === 'A' && !t.hasAttribute('target') &&
            !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) &&
            halamanSama(t.getAttribute('href'))) {
            simpan();
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', pulihkan);
    } else {
        pulihkan();
    }

    /* pengaman: pastikan halaman selalu tampil walau pemulihan gagal */
    setTimeout(function () {
        try { document.documentElement.classList.remove('rn-restore'); } catch (e) {}
    }, 1200);
})();

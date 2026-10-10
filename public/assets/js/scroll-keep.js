/* Pertahankan posisi scroll saat halaman memuat ulang karena filter / pindah
   halaman / paginasi (navigasi GET pada halaman yang sama), supaya tidak
   lompat balik ke atas. Aksi form POST (simpan/invoice/bayar) TIDAK dipertahankan
   — itu memang lebih baik dibuka dari atas supaya pesan konfirmasi terlihat.

   Dua sumbu disimpan terpisah: posisi vertikal jendela, dan geseran samping tiap
   papan kalender (.kal-wrap, ber-overflow-x) supaya kolom yang sedang dilihat
   tidak balik ke paling kiri setelah halaman dimuat ulang.

   Tiga perilaku tambahan (navigasi lunak):
   - Kunci lengket `rn_scroll_terakhir:<path>` + stempel waktu: dipakai HANYA
     saat kembali/maju (tipe navigasi back_forward) dan masih segar (10 menit),
     karena kunci sekali-pakai sudah terkonsumsi halaman sebelumnya.
   - `rn_fokus:<path>`: id elemen yang difokuskan sebelum reload, dipulihkan
     dengan preventScroll supaya filter/paginasi kembali ke kontrol yang dipakai.
   - Tombol submit form GET dinonaktifkan setelah submit pertama (anti klik
     ganda); nilai query tetap utuh karena tombol filter tidak punya name/value. */
(function () {
    'use strict';

    if ('scrollRestoration' in history) {
        try { history.scrollRestoration = 'manual'; } catch (e) {}
    }

    var key = 'rn_scroll:' + location.pathname;
    /* geseran horizontal tiap .kal-wrap, urut dokumen (papan unit, lalu driver) */
    var keyH = 'rn_scroll_h:' + location.pathname;
    var keyF = 'rn_fokus:' + location.pathname;
    var keyL = 'rn_scroll_terakhir:' + location.pathname;
    var SEGAR_MS = 10 * 60 * 1000;

    function papan() {
        return document.querySelectorAll('.kal-wrap');
    }

    function simpan(satuKali) {
        try {
            var y = window.scrollY || window.pageYOffset || 0;
            if (satuKali) {
                sessionStorage.setItem(key, String(y));
            }
            /* salinan lengket: dipakai back/forward — baik saat reload dokumen
               (tipe back_forward) maupun traversal sesama dokumen (popstate) */
            sessionStorage.setItem(keyL, JSON.stringify({ y: y, t: Date.now() }));
            if (satuKali) {
                var p = papan();
                var kiri = [];
                for (var i = 0; i < p.length; i++) kiri.push(p[i].scrollLeft);
                sessionStorage.setItem(keyH, JSON.stringify(kiri));
            }

            /* id elemen fokus (input filter punya id) untuk dipulihkan setelah reload */
            var aktif = document.activeElement;
            if (aktif && aktif.id) sessionStorage.setItem(keyF, aktif.id);
            else sessionStorage.removeItem(keyF);
        } catch (e) {}
    }

    function pulihkan() {
        /* Fokus: konsumsi kuncinya dulu, lalu coba sampai elemen muncul — konten
           bisa masih streaming saat skrip ini jalan. Berhenti bila user sudah
           mengklik input lain (jangan rebut fokus). Tanpa id / tak ditemukan = abaikan. */
        var fId = null;
        try {
            fId = sessionStorage.getItem(keyF);
            sessionStorage.removeItem(keyF);
        } catch (e0) {}

        /* Geseran horizontal .kal-wrap: elemen juga bisa belum ada — konsumsi &
           terapkan lewat interval yang sama. */
        var kiri = null;
        try {
            var kh = sessionStorage.getItem(keyH);
            if (kh !== null) {
                kiri = JSON.parse(kh) || [];
                sessionStorage.removeItem(keyH);
            }
        } catch (e1) {}

        var y = null;
        try {
            var v = sessionStorage.getItem(key);
            if (v !== null) {
                y = parseInt(v, 10) || 0;
                sessionStorage.removeItem(key);
            } else {
                /* Kembali/maju: kunci sekali-pakai halaman ini sudah terpakai saat
                   ditinggal — pakai salinan lengket, hanya untuk back_forward & segar. */
                var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
                var tipe = nav && nav[0] ? nav[0].type : '';
                var mentah = sessionStorage.getItem(keyL);
                if (tipe === 'back_forward' && mentah) {
                    var data = JSON.parse(mentah);
                    if (data && typeof data.y === 'number' && Date.now() - data.t < SEGAR_MS) {
                        y = data.y;
                    }
                }
            }
        } catch (e2) {}

        if (y !== null) {
            /* Pemulihan posisi harus instan. `html { scroll-behavior: smooth }`
               (app.css) membuat window.scrollTo ikut dianimasikan, sehingga
               halaman terlihat meluncur dari atas. Matikan sebentar lewat inline
               style (menang atas stylesheet), lalu kembalikan nilai semula. */
            try {
                var html = document.documentElement;
                var semula = html.style.scrollBehavior;
                html.style.scrollBehavior = 'auto';
                try { window.scrollTo(0, y); }
                finally { html.style.scrollBehavior = semula; }
            } catch (e3) {}
        }

        if (fId !== null || kiri !== null) {
            var coba = 0;
            var t = setInterval(function () {
                var fokusSelesai = true;
                if (fId !== null) {
                    var el = document.getElementById(fId);
                    var aktif = document.activeElement;
                    var userPunya = aktif && aktif !== el &&
                        (aktif.tagName === 'INPUT' || aktif.tagName === 'TEXTAREA' ||
                         aktif.tagName === 'SELECT' || aktif.isContentEditable);
                    if (userPunya) {
                        fId = null;
                    } else if (el && aktif !== el && typeof el.focus === 'function') {
                        try { el.focus({ preventScroll: true }); }
                        catch (e4) { try { el.focus(); } catch (e5) {} }
                    }
                    fokusSelesai = fId === null || document.activeElement === el;
                }
                if (kiri !== null) {
                    var p = papan();
                    if (p.length > 0) {
                        for (var i = 0; i < p.length && i < kiri.length; i++) {
                            var semulaH = p[i].style.scrollBehavior;
                            p[i].style.scrollBehavior = 'auto';
                            p[i].scrollLeft = parseInt(kiri[i], 10) || 0;
                            p[i].style.scrollBehavior = semulaH;
                        }
                        kiri = null;
                    }
                }
                if ((fokusSelesai && kiri === null) || ++coba >= 20) {
                    clearInterval(t);
                }
            }, 100);
        }

        /* tampilkan kembali halaman (disembunyikan sementara di <head> supaya
           tidak flash ke atas sebelum posisi scroll dipulihkan) */
        try { document.documentElement.classList.remove('rn-restore'); } catch (e6) {}
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
            simpan(true);
            /* anti klik ganda: tombol dinonaktifkan setelah submit berjalan;
               tombol filter GET tidak punya name/value jadi query tak berubah. */
            var btn = (e.submitter && e.submitter.tagName === 'BUTTON') ? e.submitter
                : f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
            if (btn) { btn.disabled = true; }
        }
    }, true);

    /* tautan pada halaman yang sama (filter, paginasi, ganti periode) -> kunci
       sekali-pakai; tautan lintas-menu (Link lunak) -> salinan lengket saja,
       supaya Back/maju bisa memulihkan posisi. Lewati klik yang tidak menavigasi
       di tab ini (tombol pengubah, tab baru) supaya salinan tidak basi. */
    document.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== document && t.tagName !== 'A') t = t.parentNode;
        if (t && t.tagName === 'A' && !t.hasAttribute('target') &&
            !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) &&
            t.getAttribute('href') && t.getAttribute('href').charAt(0) !== '#') {
            simpan(halamanSama(t.getAttribute('href')));
        }
    }, true);

    /* Kembali/maju sesama dokumen (soft nav): tak ada eksekusi ulang skrip,
       jadi pulihkan posisi di sini. Fokus & horizontal mengikuti pemulihan saat
       load; browser sendiri memulihkan fokus saat traversal. */
    window.addEventListener('popstate', function () {
        try {
            var mentah = sessionStorage.getItem('rn_scroll_terakhir:' + location.pathname);
            if (!mentah) { return; }
            var data = JSON.parse(mentah);
            if (!data || typeof data.y !== 'number' || Date.now() - data.t >= SEGAR_MS) { return; }
            var target = data.y;
            var html = document.documentElement;
            var semula = html.style.scrollBehavior;
            html.style.scrollBehavior = 'auto';
            var coba = 0;
            var t = setInterval(function () {
                /* Terapkan berulang: konten rute tujuan masih menyusun diri —
                   berhenti begitu posisi menempel atau percobaan habis. */
                try { window.scrollTo(0, target); } catch (e) {}
                if (window.scrollY === target || ++coba >= 20) {
                    clearInterval(t);
                    html.style.scrollBehavior = semula;
                }
            }, 100);
        } catch (e) {}
    });

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

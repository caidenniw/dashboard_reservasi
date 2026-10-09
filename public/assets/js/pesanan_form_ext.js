/* Skrip khusus halaman form pesanan — SALINAN dari @push('skrip') di
   resources/views/pesanan/form.blade.php.
   1) Picker kota: ketik -> daftar tersaring (tanpa pustaka tambahan).
   2) Tambah / hapus baris rute.
   Kelas .rn-picker* & .baris-rute adalah kontrak; jangan diganti namanya. */
(function () {
    'use strict';

    document.querySelectorAll('[data-picker]').forEach(function (kotak) {
        var cari = kotak.querySelector('[data-picker-cari]');
        var nilai = kotak.querySelector('[data-picker-nilai]');
        var daftar = kotak.querySelector('[data-picker-daftar]');
        if (!cari || !daftar) return;
        var semua = Array.prototype.slice.call(daftar.querySelectorAll('.rn-picker-item'));

        function tampilkan() {
            var kata = (cari.value || '').trim().toLowerCase();
            var tampil = 0;
            semua.forEach(function (it) {
                var cocok = kata === '' || it.dataset.nilai.toLowerCase().indexOf(kata) !== -1;
                it.hidden = !cocok;
                if (cocok) tampil++;
            });
            daftar.querySelectorAll('.rn-picker-judul').forEach(function (j) { j.hidden = kata !== ''; });
            var kosong = daftar.querySelector('.rn-picker-kosong');
            if (!kosong) {
                kosong = document.createElement('div');
                kosong.className = 'rn-picker-kosong';
                daftar.appendChild(kosong);
            }
            kosong.textContent = 'Tidak ada di daftar — kota "' + cari.value.trim() + '" akan dipakai apa adanya.';
            kosong.hidden = !(tampil === 0 && kata !== '');
        }

        cari.addEventListener('focus', function () { daftar.hidden = false; tampilkan(); });
        cari.addEventListener('input', function () { nilai.value = cari.value; daftar.hidden = false; tampilkan(); });
        cari.addEventListener('blur', function () { setTimeout(function () { daftar.hidden = true; }, 160); });
        daftar.addEventListener('click', function (e) {
            var it = e.target.closest('.rn-picker-item');
            if (!it) return;
            cari.value = it.dataset.nilai;
            nilai.value = it.dataset.nilai;
            daftar.hidden = true;
        });
    });

    /* ============ Tambah / hapus rute ============ */
    var wadahRute = document.getElementById('wadahRute');
    var tplRute = document.getElementById('tplRute');
    var btnRute = document.getElementById('btnTambahRute');
    if (wadahRute && tplRute && btnRute) {
        btnRute.addEventListener('click', function () {
            wadahRute.appendChild(tplRute.content.cloneNode(true));
        });
        wadahRute.addEventListener('click', function (e) {
            if (e.target.classList.contains('btn-hapus-rute')) {
                e.target.closest('.baris-rute').remove();
            }
        });
    }
})();

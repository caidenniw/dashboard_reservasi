/* 1000 Nusantara Rental - helper UI kecil (tanpa framework JS) */

/* ---------- Form pesanan: hitung ringkasan otomatis ---------- */
function rnFormatRupiah(n) {
    n = Math.round(Number(n) || 0);
    return 'Rp ' + n.toLocaleString('id-ID');
}
function rnAngka(str) {
    return parseInt(String(str || '').replace(/[^0-9]/g, ''), 10) || 0;
}

function rnSamaTeks(a, b) {
    return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
}
function rnSamaAngka(a, b) {
    return rnAngka(a) === rnAngka(b);
}
/* Samakan nomor HP beda format: +62853..., 0853..., 62853... dianggap sama. */
function rnSamaHp(a, b) {
    function digit(s) {
        return String(s == null ? '' : s).replace(/[^0-9]/g, '').replace(/^(62|0)/, '');
    }
    var da = digit(a), db = digit(b);
    return da !== '' && da === db;
}

/* Putuskan nilai field saat dropdown diganti: ikut data baru kalau masih kosong
   atau masih sama dengan bawaan lama; kembalikan ubah:false bila ketikan manual. */
function rnPutuskanIkut(nilai, prev, baru, sama) {
    var s = String(nilai == null ? '' : nilai).trim();
    if (s === '') return { ubah: true, nilai: baru };
    var p = String(prev == null ? '' : prev).trim();
    if ((sama || rnSamaTeks)(s, p)) return { ubah: true, nilai: baru };
    return { ubah: false };
}

/* Terapkan data unit baru ke satu blok (nama+nopol+modal+jual).
   dsBaru null = pilihan dikosongkan: identitas dibersihkan, harga manual tetap. */
function rnTerapkanUnit(sel, dsBaru, kotak) {
    var namaBaru = dsBaru ? (dsBaru.nama || '') : '';
    var nopolBaru = dsBaru ? (dsBaru.nopol || '') : '';
    var modalBaru = dsBaru ? (dsBaru.modal || '') : '';
    var jualBaru = dsBaru ? (dsBaru.jual || '') : '';
    var prev = (sel && sel.dataset) ? sel.dataset : {};
    var fNama = kotak.querySelector('[name="item_nama_unit[]"]');
    var fNopol = kotak.querySelector('[name="item_nopol[]"]');
    var fModal = kotak.querySelector('[name="item_harga_modal[]"]');
    var fJual = kotak.querySelector('[name="item_harga_jual[]"]');
    var r;
    r = rnPutuskanIkut(fNama.value, prev.prevNama, namaBaru);
    if (r.ubah) fNama.value = r.nilai;
    r = rnPutuskanIkut(fNopol.value, prev.prevNopol, nopolBaru);
    if (r.ubah) fNopol.value = r.nilai;
    r = rnPutuskanIkut(fModal.value, prev.prevModal, modalBaru, rnSamaAngka);
    if (r.ubah) fModal.value = r.nilai;
    r = rnPutuskanIkut(fJual.value, prev.prevJual, jualBaru, rnSamaAngka);
    if (r.ubah) fJual.value = r.nilai;
    if (dsBaru && sel && sel.dataset) {
        sel.dataset.prevNama = namaBaru;
        sel.dataset.prevNopol = nopolBaru;
        sel.dataset.prevModal = modalBaru;
        sel.dataset.prevJual = jualBaru;
    }
}

/* Terapkan data driver baru ke satu blok (nama+HP). Aturan sama seperti unit. */
function rnTerapkanDriver(sel, dsBaru, kotak) {
    var namaBaru = dsBaru ? (dsBaru.nama || '') : '';
    var hpBaru = dsBaru ? (dsBaru.hp || '') : '';
    var prev = (sel && sel.dataset) ? sel.dataset : {};
    var fNama = kotak.querySelector('[name="item_nama_driver[]"]');
    var fHp = kotak.querySelector('[name="item_hp_driver[]"]');
    var r;
    r = rnPutuskanIkut(fNama.value, prev.prevNama, namaBaru);
    if (r.ubah) fNama.value = r.nilai;
    r = rnPutuskanIkut(fHp.value, prev.prevHp, hpBaru, rnSamaHp);
    if (r.ubah) fHp.value = r.nilai;
    if (dsBaru && sel && sel.dataset) {
        sel.dataset.prevNama = namaBaru;
        sel.dataset.prevHp = hpBaru;
    }
}

/* Catat bawaan awal tiap dropdown (mode edit: dari option terpilih) agar
   gantian pertama bisa bedakan nilai auto vs ketikan manual tersimpan. */
function rnInitPrevPilihan(form) {
    form.querySelectorAll('.pilih-unit').forEach(function (sel) {
        var opt = sel.options[sel.selectedIndex];
        if (opt && sel.value && opt.dataset) {
            sel.dataset.prevNama = opt.dataset.nama || '';
            sel.dataset.prevNopol = opt.dataset.nopol || '';
            sel.dataset.prevModal = opt.dataset.modal || '';
            sel.dataset.prevJual = opt.dataset.jual || '';
        }
    });
    form.querySelectorAll('.pilih-driver').forEach(function (sel) {
        var opt = sel.options[sel.selectedIndex];
        if (opt && sel.value && opt.dataset) {
            sel.dataset.prevNama = opt.dataset.nama || '';
            sel.dataset.prevHp = opt.dataset.hp || '';
        }
    });
}

function rnSiapkanFormPesanan() {
    var form = document.getElementById('formPesanan');
    if (!form) return;

    /* jumlah hari dari tanggal */
    var mulai = form.querySelector('[name="tgl_mulai"]');
    var finish = form.querySelector('[name="tgl_finish"]');
    var hari = form.querySelector('[name="jumlah_hari"]');

    function hitungHari() {
        if (!mulai.value || !finish.value) return;
        var a = new Date(mulai.value), b = new Date(finish.value);
        var d = Math.floor((b - a) / 86400000) + 1;
        if (d > 0) {
            hari.value = d;
            form.querySelectorAll('[name="item_jumlah_hari[]"]').forEach(function (el) { el.value = d; });
        }
    }
    mulai.addEventListener('change', hitungHari);
    finish.addEventListener('change', hitungHari);

    /* ringkasan biaya */
    function ringkas() {
        var totalJual = 0, totalModal = 0;
        form.querySelectorAll('.item-unit').forEach(function (kotak) {
            var jual = rnAngka(kotak.querySelector('[name="item_harga_jual[]"]').value);
            var modal = rnAngka(kotak.querySelector('[name="item_harga_modal[]"]').value);
            var h = parseInt(kotak.querySelector('[name="item_jumlah_hari[]"]').value, 10) || 0;
            var elSubJual = kotak.querySelector('.sub-jual');
            if (elSubJual) elSubJual.textContent = rnFormatRupiah(jual * h);
            /* .sub-modal tidak selalu ada (disembunyikan untuk peran tanpa hak modal) */
            var elSubModal = kotak.querySelector('.sub-modal');
            if (elSubModal) elSubModal.textContent = rnFormatRupiah(modal * h);
            totalJual += jual * h;
            totalModal += modal * h;
        });

        var tambahan = 0;
        form.querySelectorAll('[name="biaya_nominal[]"]').forEach(function (el) {
            tambahan += rnAngka(el.value);
        });
        form.querySelectorAll('[name^="include_biaya"]').forEach(function (el) {
            tambahan += rnAngka(el.value);
        });

        var grand = totalJual + tambahan;
        var panjarEl = document.getElementById('panjar');
        var panjar = panjarEl ? rnAngka(panjarEl.value) : 0;
        var sisa = Math.max(0, grand - panjar);
        /* Sebagian elemen ringkasan hanya ada untuk peran ber-hak modal (rkModal/rkMargin)
           karena kolom internal disembunyikan -> tulis dengan penjaga supaya ringkasan
           lain (jual/tambahan/total) tetap ter-update. */
        function tulis(id, teks) { var el = document.getElementById(id); if (el) el.textContent = teks; }
        tulis('rkJual', rnFormatRupiah(totalJual));
        tulis('rkModal', rnFormatRupiah(totalModal));
        tulis('rkTambahan', rnFormatRupiah(tambahan));
        tulis('rkTotal', rnFormatRupiah(grand));
        tulis('rkPanjar', rnFormatRupiah(panjar));
        tulis('rkSisa', rnFormatRupiah(sisa));
        tulis('rkSisa2', rnFormatRupiah(sisa));
        tulis('rkMargin', rnFormatRupiah(grand - totalModal));
    }

    form.addEventListener('input', ringkas);
    form.addEventListener('change', ringkas);

    /* tambah / hapus unit */
    var wadah = document.getElementById('wadahUnit');
    var tpl = document.getElementById('tplUnit');
    form.querySelector('#btnTambahUnit').addEventListener('click', function () {
        var node = tpl.content.cloneNode(true);
        wadah.appendChild(node);
        perbaruiNomorUnit();
        ringkas();
    });
    wadah.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('btn-hapus-unit')) {
            var kotak = ev.target.closest('.item-unit');
            if (wadah.querySelectorAll('.item-unit').length <= 1) {
                alert('Minimal satu unit.');
                return;
            }
            kotak.remove();
            perbaruiNomorUnit();
            ringkas();
        }
        if (ev.target.classList.contains('btn-hapus-biaya')) {
            ev.target.closest('.baris-biaya').remove();
            ringkas();
        }
    });
    function perbaruiNomorUnit() {
        var items = wadah.querySelectorAll('.item-unit');
        items.forEach(function (k, i) {
            var label = k.querySelector('.unit-no');
            if (label) label.textContent = 'Armada / Mobil ' + (i + 1);
            var btnHapus = k.querySelector('.btn-hapus-unit');
            if (btnHapus) {
                btnHapus.style.display = (items.length > 1) ? 'inline-block' : 'none';
            }
        });
    }

    /* tambah baris biaya tambahan */
    var wadahBiaya = document.getElementById('wadahBiaya');
    var tplBiaya = document.getElementById('tplBiaya');
    var btnBiaya = document.getElementById('btnTambahBiaya');
    if (btnBiaya) {
        btnBiaya.addEventListener('click', function () {
            wadahBiaya.appendChild(tplBiaya.content.cloneNode(true));
            ringkas();
        });
    }

    /* pilih unit -> nama+nopol selalu melengkapi; harga melengkapi bila belum diubah manual */
    form.addEventListener('change', function (ev) {
        if (ev.target.classList.contains('pilih-unit')) {
            var sel = ev.target;
            var opt = sel.options[sel.selectedIndex];
            var kotak = sel.closest('.item-unit');
            if (!opt || !sel.value) {
                rnTerapkanUnit(sel, null, kotak);
            } else {
                rnTerapkanUnit(sel, opt.dataset, kotak);
            }
            ringkas();
        }
    });

    /* pilih driver -> nama+HP selalu melengkapi dengan aturan yang sama seperti unit */
    form.addEventListener('change', function (ev) {
        if (ev.target.classList.contains('pilih-driver')) {
            var sel = ev.target;
            var opt = sel.options[sel.selectedIndex];
            var kotak = sel.closest('.item-unit');
            if (!opt || !sel.value) {
                rnTerapkanDriver(sel, null, kotak);
            } else {
                rnTerapkanDriver(sel, opt.dataset, kotak);
            }
        }
    });

    rnInitPrevPilihan(form);

    perbaruiNomorUnit();
    ringkas();
}

/* ---------- salin teks WA ---------- */
function rnSalin(idTeks, idTombol) {
    var el = document.getElementById(idTeks);
    var btn = document.getElementById(idTombol);
    if (!el) return;
    var teks = el.value || el.textContent;
    function sukses() {
        var asli = btn.textContent;
        btn.textContent = 'Tersalin';
        setTimeout(function () { btn.textContent = asli; }, 1800);
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(teks).then(sukses, function () { el.select(); document.execCommand('copy'); sukses(); });
    } else {
        el.select();
        document.execCommand('copy');
        sukses();
    }
}

/* ---------- konfirmasi aksi (dialog native, bukan alert bawaan) ---------- */
(function () {
    function pasang() {
    var formTertunda = null;
    var modalEl = document.getElementById('rnKonfirmasi');
    var pesanEl = document.getElementById('rnKonfirmasiPesan');
    var judulEl = document.getElementById('rnKonfirmasiJudul');
    var konteksEl = document.getElementById('rnKonfirmasiKonteks');
    var ikonEl = document.getElementById('rnKonfirmasiIkon');
    var yaBtn = document.getElementById('rnKonfirmasiYa');
    var batalBtn = document.getElementById('rnKonfirmasiBatal');
    if (!modalEl || typeof modalEl.showModal !== 'function') {
        // Fallback: <dialog> tidak tersedia, pakai confirm bawaan. Jangan pernah tanpa konfirmasi.
        document.addEventListener('submit', function (ev) {
            var f = ev.target;
            if (f.dataset && f.dataset.konfirmasi && f.dataset.lolosKonfirmasi !== '1') {
                if (!window.confirm(f.dataset.konfirmasi)) ev.preventDefault();
            }
        });
        return;
    }
    var pemicuSubmit = null;
    var terkunciFokus = false;
    function kunciFokus() {
        if (terkunciFokus) return;
        terkunciFokus = true;
        modalEl.addEventListener('keydown', jebakFokus);
    }
    function lepasFokus() {
        terkunciFokus = false;
        modalEl.removeEventListener('keydown', jebakFokus);
    }
    function jebakFokus(ev) {
        if (ev.key !== 'Tab') return;
        var daftar = [batalBtn, yaBtn].filter(function (el) { return el && !el.disabled; });
        if (daftar.length === 0) return;
        var pertama = daftar[0];
        var terakhir = daftar[daftar.length - 1];
        if (ev.shiftKey && document.activeElement === pertama) { ev.preventDefault(); terakhir.focus(); return; }
        if (!ev.shiftKey && document.activeElement === terakhir) { ev.preventDefault(); pertama.focus(); }
    }
    function kembalikanFokus() {
        lepasFokus();
        if (pemicuSubmit && document.contains(pemicuSubmit)) pemicuSubmit.focus();
        pemicuSubmit = null;
    }
    if (batalBtn) { batalBtn.addEventListener('click', function () { formTertunda = null; modalEl.close(); kembalikanFokus(); }); }
    // Escape native menutup <dialog> lewat event "cancel" — bersihkan formTertunda
    // (kalau tidak, submit susulan bisa lolos tanpa konfirmasi).
    modalEl.addEventListener('cancel', function () { formTertunda = null; kembalikanFokus(); });
    modalEl.addEventListener('close', function () { lepasFokus(); });
    var modal = { show: function () { modalEl.showModal(); kunciFokus(); if (batalBtn) batalBtn.focus(); }, hide: function () { modalEl.close(); } };

    document.addEventListener('submit', function (ev) {
        var f = ev.target;
        if (!f.dataset || !f.dataset.konfirmasi || f.dataset.lolosKonfirmasi === '1') return;
        ev.preventDefault();
        formTertunda = f;
        pemicuSubmit = f.querySelector('button[type="submit"]') || document.activeElement;
        pesanEl.textContent = f.dataset.konfirmasi;
        // Judul + warna tombol ikut jenis aksi: hapus/batal = bahaya (merah), sisanya normal
        var tombolAsli = f.querySelector('button[type="submit"]');
        var labelAsli = tombolAsli ? tombolAsli.textContent.trim() : '';
        var bahaya = (/hapus|batal|nonaktif/i.test(f.dataset.konfirmasi) || /hapus|batal/i.test(labelAsli)) && !/revisi/i.test(f.dataset.konfirmasi);
        judulEl.textContent = bahaya ? 'Hapus data?' : 'Lanjutkan?';
        yaBtn.textContent = labelAsli !== '' ? labelAsli : 'Ya, lanjutkan';
        yaBtn.className = 'btn ' + (bahaya ? 'btn-danger' : 'btn-primary');
        // Konteks: nomor order + nama pesanan dari judul halaman biar yakin hapus yang benar
        var judulHal = document.querySelector('.page-title');
        var teksHal = judulHal ? judulHal.textContent.trim() : '';
        if (konteksEl) konteksEl.textContent = teksHal !== '' ? teksHal : '';
        if (ikonEl) ikonEl.setAttribute('data-jenis', bahaya ? 'bahaya' : 'normal');
        modal.show();
    });

    yaBtn.addEventListener('click', function () {
        if (!formTertunda) return;
        var f = formTertunda;
        formTertunda = null;
        modal.hide();
        f.dataset.lolosKonfirmasi = '1';
        f.submit();
    });
    } // end pasang()
    // Script sudah di bawah modal (footer), tapi tetap tunggu DOM siap kalau parsed lebih awal
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', pasang);
    } else {
        pasang();
    }
})();

document.addEventListener('DOMContentLoaded', rnSiapkanFormPesanan);

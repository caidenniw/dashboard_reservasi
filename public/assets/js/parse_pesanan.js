/* Bedah teks pesanan -> isi otomatis form pesanan baru.
   Dipakai di halaman Input Pesanan Baru (pages/pesanan_form.php).
   Sengaja tanpa framework; memanfaatkan helper global dari app.js
   (rnAngka, rnFormatRupiah) bila tersedia, dengan cadangan sendiri. */
(function () {
    'use strict';

    function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    onReady(function () {
        var kartu = document.getElementById('kartuBedah');
        if (!kartu) return;

        var form = document.getElementById('formPesanan');
        var ta = document.getElementById('teksPesanan');
        var out = document.getElementById('hasilBedah');
        var btn = document.getElementById('btnBedah');
        var btnBersih = document.getElementById('btnBedahBersih');
        if (!form || !ta || !btn) return;

        var url = kartu.getAttribute('data-parse-url') || '/api/parse_pesanan.php';
        var token = kartu.getAttribute('data-parse-token') || '';

        function angka(v) {
            if (typeof rnAngka === 'function') return rnAngka(v);
            return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;
        }
        function ribuan(v) { return angka(v).toLocaleString('id-ID'); }
        function e(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
            });
        }
        function sorot(el) { if (el && el.classList) el.classList.add('rn-terisi'); }

        function setField(nama, nilai, opsi) {
            opsi = opsi || {};
            var el = form.elements[nama];
            if (!el || nilai === undefined || nilai === null) return false;
            if (el.tagName === 'SELECT') {
                var ada = false;
                for (var i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === String(nilai)) { ada = true; break; }
                }
                if (!ada) return false;
                el.value = String(nilai);
            } else if (el.type === 'checkbox') {
                el.checked = !!nilai;
            } else {
                if (String(nilai).trim() === '') return false;
                el.value = opsi.format ? ribuan(nilai) : nilai;
            }
            if (opsi.sorot !== false) sorot(el);
            return true;
        }

        var petaTipe = { retail: 'retail', perorangan: 'retail', perusahaan: 'corporate', instansi: 'corporate', RO: 'RO', RTR: 'RTR' };

        function isiBlokArmada(kotak, it) {
            var selUnit = kotak.querySelector('.pilih-unit');
            var selDriver = kotak.querySelector('.pilih-driver');
            if (selUnit && it.unit_id) { selUnit.value = String(it.unit_id); sorot(selUnit); selUnit.dataset.prevNama = it.nama_unit || ''; selUnit.dataset.prevNopol = it.nopol || ''; }
            if (selDriver && it.driver_id) { selDriver.value = String(it.driver_id); sorot(selDriver); selDriver.dataset.prevNama = it.nama_driver || ''; selDriver.dataset.prevHp = it.hp_driver || ''; }

            var f;
            f = kotak.querySelector('[name="item_nama_driver[]"]'); if (f && it.nama_driver) { f.value = it.nama_driver; sorot(f); }
            f = kotak.querySelector('[name="item_hp_driver[]"]'); if (f && it.hp_driver) { f.value = it.hp_driver; sorot(f); }
            f = kotak.querySelector('[name="item_nama_unit[]"]'); if (f && it.nama_unit) { f.value = it.nama_unit; sorot(f); }
            f = kotak.querySelector('[name="item_nopol[]"]'); if (f && it.nopol) { f.value = it.nopol; sorot(f); }
            f = kotak.querySelector('[name="item_harga_modal[]"]'); if (f && angka(it.harga_modal_per_hari) > 0) { f.value = ribuan(it.harga_modal_per_hari); sorot(f); }
            f = kotak.querySelector('[name="item_harga_jual[]"]'); if (f && angka(it.harga_jual_per_hari) > 0) { f.value = ribuan(it.harga_jual_per_hari); sorot(f); }
            f = kotak.querySelector('[name="item_jumlah_hari[]"]'); if (f && angka(it.jumlah_hari) > 0) { f.value = angka(it.jumlah_hari); sorot(f); }
        }

        function siapkanArmada(items) {
            var wadah = document.getElementById('wadahUnit');
            var tpl = document.getElementById('tplUnit');
            if (!wadah) return 0;
            if (!items || !items.length) return 0;

            wadah.innerHTML = '';
            for (var i = 0; i < items.length; i++) {
                var kotak;
                if (tpl) {
                    kotak = tpl.content.cloneNode(true).querySelector('.item-unit');
                    wadah.appendChild(kotak);
                } else {
                    kotak = wadah.querySelector('.item-unit');
                }
                var noEl = kotak.querySelector('.unit-no');
                if (noEl) noEl.textContent = 'Armada / Mobil ' + (i + 1);
                var hapus = kotak.querySelector('.btn-hapus-unit');
                if (hapus) hapus.style.display = (items.length > 1) ? '' : 'none';
                isiBlokArmada(kotak, items[i]);
            }
            return items.length;
        }

        function isiBiaya(biaya) {
            var wadah = document.getElementById('wadahBiaya');
            var tpl = document.getElementById('tplBiaya');
            if (!wadah || !tpl || !biaya || !biaya.length) return 0;
            wadah.innerHTML = '';
            var n = 0;
            for (var i = 0; i < biaya.length; i++) {
                var row = tpl.content.cloneNode(true).querySelector('.baris-biaya');
                wadah.appendChild(row);
                var fNama = row.querySelector('[name="biaya_nama[]"]');
                var fNom = row.querySelector('[name="biaya_nominal[]"]');
                if (fNama) { fNama.value = biaya[i].nama || ''; sorot(fNama); }
                if (fNom) { fNom.value = ribuan(biaya[i].nominal || 0); sorot(fNom); }
                n++;
            }
            return n;
        }

        function isiInclude(incs) {
            var n = 0;
            (incs || []).forEach(function (inc) {
                var cb = document.getElementById('inc_' + inc.id);
                if (cb) { cb.checked = true; sorot(cb); n++; }
            });
            return n;
        }

        function tampilkanHasil(d, ringkas) {
            if (!out) return;
            var html = '';
            html += '<div class="rn-bedah-box">';
            html += '<div class="rn-bedah-judul">Hasil bedah: '
                + (d.sumber === 'parser+ai' ? 'pembaca pola + bantuan AI' : 'pembaca pola')
                + ' &middot; keyakinan ' + d.yakin + '%</div>';
            html += '<div class="text-soft">' + ringkas + '</div>';
            if (d.catatan && d.catatan.length) {
                html += '<ul class="mb-0 mt-1 ps-3 rn-bedah-warn">';
                d.catatan.forEach(function (c) { html += '<li>' + e(c) + '</li>'; });
                html += '</ul>';
            }
            if (d.tidak_dikenali && d.tidak_dikenali.length) {
                html += '<details class="mt-1"><summary class="text-soft">Lihat ' + d.tidak_dikenali.length + ' baris yang belum terbaca</summary><pre class="mb-0 mt-1" style="font-size:.8rem;white-space:pre-wrap">';
                d.tidak_dikenali.forEach(function (l) { html += e(l) + '\n'; });
                html += '</pre></details>';
            }
            html += '<div class="text-soft mt-1">Field yang terisi otomatis disorot kuning. Periksa dulu, lalu Simpan.</div>';
            html += '</div>';
            out.innerHTML = html;
        }

        function kosongkanHasil() { if (out) out.innerHTML = ''; }

        function bersihkanSorot() {
            form.querySelectorAll('.rn-terisi').forEach(function (el) { el.classList.remove('rn-terisi'); });
        }

        function terapkan(d) {
            bersihkanSorot();
            var terisi = 0, ringkas = [];

            if (setField('wilayah_pelayanan', d.data.wilayah_pelayanan)) terisi++;
            if (setField('kota', d.data.kota)) {
                /* Kolom kota berbentuk PICKER (input tersembunyi + kotak cari).
                   Samakan keduanya supaya isi hasil bedah TERLIHAT di kotak pencarian. */
                var cariKota = document.querySelector('[data-picker-cari]');
                if (cariKota) { cariKota.value = d.data.kota; cariKota.classList.add('rn-terisi'); }
                terisi++;
            }
            if (setField('tgl_mulai', d.data.tgl_mulai)) terisi++;
            if (setField('tgl_finish', d.data.tgl_finish)) terisi++;
            if (setField('jam', d.data.jam)) terisi++;
            if (setField('standby_point', d.data.standby_point)) terisi++;
            if (setField('flight', d.data.flight)) terisi++;
            if (angka(d.data.jam_koordinasi) === 1) {
                var jk = form.elements['jam_koordinasi'];
                if (jk) { jk.checked = true; sorot(jk); }
            }

            if (setField('nama_pesanan', d.data.nama_pesanan)) terisi++;
            if (setField('nama_pic', d.data.nama_pic)) terisi++;
            if (setField('hp_pic', d.data.hp_pic)) terisi++;

            /* saran nilai yang tidak ada di teks (default aman) */
            if (d.saran && d.saran.tipe_pelanggan) {
                var tipe = petaTipe[d.saran.tipe_pelanggan] || 'retail';
                if (setField('tipe_pelanggan', tipe)) { terisi++; ringkas.push('tipe pelanggan diset default: ' + tipe); }
            }
            if (d.saran && d.saran.sumber) {
                if (setField('sumber', d.saran.sumber)) { terisi++; ringkas.push('sumber order diset default: ' + d.saran.sumber); }
            }

            var nArmada = siapkanArmada(d.items);
            terisi += nArmada;
            if (nArmada) ringkas.push(nArmada + ' armada terisi (modal & jual dari master bila ada)');

            var nInc = isiInclude(d.includes);
            if (nInc) { ringkas.push(nInc + ' include dicentang'); terisi++; }
            var nBiaya = isiBiaya(d.biaya);
            if (nBiaya) { ringkas.push(nBiaya + ' biaya tambahan diisi'); terisi++; }

            if (d.total_teks > 0) ringkas.push('total di teks: Rp ' + ribuan(d.total_teks));
            if (d.data && d.data.support_by) ringkas.push('Support by: ' + d.data.support_by + ' (isi di kolom vendor pada blok unit bila perlu)');

            /* picu hitung hari & ringkasan milik app.js */
            var fm = form.elements['tgl_mulai'], ff = form.elements['tgl_finish'];
            if (fm) fm.dispatchEvent(new Event('change', { bubbles: true }));
            if (ff) ff.dispatchEvent(new Event('change', { bubbles: true }));
            form.dispatchEvent(new Event('change', { bubbles: true }));

            tampilkanHasil(d, terisi + ' field terisi. ' + (ringkas.length ? ringkas.join('; ') + '.' : ''));
        }

        function bedah() {
            var teks = (ta.value || '').trim();
            if (teks === '') {
                if (out) out.innerHTML = '<div class="rn-bedah-box rn-bedah-warn">Teks masih kosong. Tempel teks konfirmasi dulu.</div>';
                return;
            }
            var labelAsli = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Membaca...';
            if (out) out.innerHTML = '<div class="rn-bedah-box text-soft">Membaca teks pesanan...</div>';

            var body = new URLSearchParams();
            body.append('token', token);
            body.append('teks', teks);

            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: body.toString(),
                credentials: 'same-origin'
            }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Balasan tidak terbaca.' }; }); })
              .then(function (j) {
                  btn.disabled = false;
                  btn.textContent = labelAsli;
                  if (!j || !j.ok) {
                      if (out) out.innerHTML = '<div class="rn-bedah-box rn-bedah-warn">' + e((j && j.error) || 'Gagal membaca teks.') + '</div>';
                      return;
                  }
                  terapkan(j);
              })
              .catch(function (err) {
                  btn.disabled = false;
                  btn.textContent = labelAsli;
                  if (out) out.innerHTML = '<div class="rn-bedah-box rn-bedah-warn">Gagal menghubungi pembaca teks: ' + e(err.message || err) + '</div>';
              });
        }

        btn.addEventListener('click', bedah);

        if (btnBersih) {
            btnBersih.addEventListener('click', function () {
                ta.value = '';
                kosongkanHasil();
                bersihkanSorot();
            });
        }
    });
})();

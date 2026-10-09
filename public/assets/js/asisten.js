/* Asisten internal dashboard reservasi.
   Dipakai dua tempat: widget mengambang (semua halaman) dan halaman penuh.
   Murni membaca data lewat POST /api/asisten (route Laravel, bukan berkas
   api/asisten.php milik sistem lama). */
(function () {
    'use strict';

    var cfg = window.RN_ASISTEN || {};
    if (!cfg.base) { cfg.base = ''; }

    function buat(tag, kelas, teks) {
        var n = document.createElement(tag);
        if (kelas) n.className = kelas;
        if (teks !== undefined) n.textContent = teks;
        return n;
    }

    function bersihkan(teks) {
        /* buang penanda markdown supaya tampil rapi sebagai teks biasa */
        return String(teks || '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/^[ \t]*[*\-]\s+/gm, '- ')
            .replace(/`+/g, '')
            .trim();
    }

    function pisahBidang(teks) {
        return String(teks || '').split(/\s*[·|]\s*/).filter(function (f) { return f.trim() !== ''; });
    }

    function nilaiUang(teks) {
        return /^rp\s?[\d.]+/i.test(String(teks || '').trim());
    }

    /* Ubah jawaban jadi baris-baris data, bukan paragraf padat.
       Aturan format diminta lewat prompt: baris rincian diawali "- " dan
       bagian dipisah " · ". Kalau model tidak mengikuti, tetap tampil apa adanya. */
    function renderBot(teks) {
        var wrap = buat('div', 'rna-isi-bot');
        var baris = String(teks || '').replace(/\r/g, '').split('\n');

        baris.forEach(function (b) {
            var t = b.trim();
            if (t === '') return;

            var mButir = t.match(/^(?:[-*•]|\d{1,2}[.)])\s+(.+)$/);
            if (mButir) {
                var bidang = pisahBidang(mButir[1]);
                if (bidang.length > 1) {
                    var row = buat('div', 'rna-row');
                    bidang.forEach(function (f, idx) {
                        var kelas = 'rna-f' + (idx === 0 ? ' rna-f-utama' : '') + (nilaiUang(f) ? ' rna-f-angka' : '');
                        row.appendChild(buat('span', kelas, f.trim()));
                    });
                    wrap.appendChild(row);
                    return;
                }
                var isi = bidang.length ? bidang[0] : mButir[1];
                var kv1 = isi.match(/^([^:]{3,30}):\s*(.+)$/);
                if (kv1) {
                    var w1 = buat('div', 'rna-kv');
                    w1.appendChild(buat('span', 'rna-k', kv1[1]));
                    w1.appendChild(buat('span', 'rna-v', kv1[2]));
                    wrap.appendChild(w1);
                    return;
                }
                var p1 = buat('div', 'rna-p', bersihkan(isi));
                p1.style.paddingLeft = '2px';
                wrap.appendChild(p1);
                return;
            }

            var kv = t.match(/^([^:]{3,30}):\s*(.+)$/);
            if (kv && !/^https?/i.test(kv[1])) {
                var w2 = buat('div', 'rna-kv');
                w2.appendChild(buat('span', 'rna-k', kv[1]));
                w2.appendChild(buat('span', 'rna-v', kv[2]));
                wrap.appendChild(w2);
                return;
            }

            wrap.appendChild(buat('div', 'rna-p', bersihkan(t)));
        });

        return wrap;
    }

    function kirim(teks, riwayat) {
        var fd = new FormData();
        fd.append('token', cfg.token || '');
        fd.append('tanya', teks);
        fd.append('riwayat', JSON.stringify(riwayat || []));
        return fetch(cfg.base + '/api/asisten', {
            method: 'POST', body: fd, credentials: 'same-origin'
        }).then(function (r) {
            return r.json().catch(function () {
                return { ok: false, error: 'Jawaban tidak terbaca (HTTP ' + r.status + ').' };
            });
        });
    }

    function pasang(root) {
        if (root.dataset.rnaSiap === '1') return;
        root.dataset.rnaSiap = '1';

        var body = root.querySelector('[data-rna-body]');
        var form = root.querySelector('[data-rna-form]');
        var input = root.querySelector('[data-rna-input]');
        var tombol = root.querySelector('[data-rna-send]');
        var riwayat = [];
        var sibuk = false;

        function tambah(kelas, teks, meta) {
            var wrap = buat('div', 'rna-msg ' + kelas);
            if (kelas === 'rna-msg-bot') {
                wrap.appendChild(renderBot(teks));
            } else {
                wrap.appendChild(buat('div', null, bersihkan(teks)));
            }
            if (meta) wrap.appendChild(buat('div', 'rna-meta', meta));
            body.appendChild(wrap);
            body.scrollTop = body.scrollHeight;
            return wrap;
        }

        function saran() {
            var daftar = [
                'Pesanan apa saja yang berjalan hari ini?',
                'Invoice mana yang belum lunas?',
                'Rekap nilai pesanan 6 bulan terakhir',
                'Unit BK 1261 OOO kosong tanggal 5-7 November 2026?'
            ];
            var box = buat('div', null, '');
            daftar.forEach(function (t) {
                var c = buat('button', 'rna-chip', t);
                c.type = 'button';
                c.addEventListener('click', function () { input.value = t; form.dispatchEvent(new Event('submit')); });
                box.appendChild(c);
            });
            box.appendChild(buat('div', 'rna-note', 'Asisten hanya membaca data. Ada yang ingin dicari?'));
            body.appendChild(box);
        }

        function tanyaKe(teks) {
            if (sibuk) return;
            sibuk = true;
            if (tombol) tombol.disabled = true;
            tambah('rna-msg-user', teks);
            var tunggu = tambah('rna-msg-info', 'Menghitung data...');
            riwayat.push({ role: 'user', text: teks });

            kirim(teks, riwayat.slice(0, -1)).then(function (res) {
                tunggu.remove();
                if (res && res.ok) {
                    tambah('rna-msg-bot', res.jawaban,
                        'Sumber data: ' + (res.sumber || 'ringkasan sistem') + ' · ' + (res.detik || '?') + ' detik');
                    riwayat.push({ role: 'asisten', text: res.jawaban });
                } else {
                    tambah('rna-msg-err', (res && res.error) || 'Gagal menghubungi asisten.');
                }
            }).catch(function () {
                tunggu.remove();
                tambah('rna-msg-err', 'Gagal menghubungi asisten. Periksa koneksi internet.');
            }).then(function () {
                sibuk = false;
                if (tombol) tombol.disabled = false;
                input.focus();
            });
        }

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var teks = String(input.value || '').trim();
            if (teks === '') return;
            input.value = '';
            tanyaKe(teks);
        });

        input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        });

        if (String(root.dataset.rnaSaran || '') === '1') saran();

        var buka = root.dataset.rnaBuka;
        if (buka) {
            var panel = document.getElementById(buka);
            var pemicu = root.dataset.rnaPemicu ? document.getElementById(root.dataset.rnaPemicu) : null;
            if (pemicu && panel) {
                var fokusable = function () {
                    return Array.prototype.slice.call(
                        panel.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
                    ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
                };
                var tutup = function () {
                    panel.classList.remove('rna-open');
                    pemicu.setAttribute('aria-expanded', 'false');
                    pemicu.focus();
                };
                pemicu.addEventListener('click', function () {
                    if (panel.classList.contains('rna-open')) { tutup(); return; }
                    panel.classList.add('rna-open');
                    pemicu.setAttribute('aria-expanded', 'true');
                    input.focus();
                });
                var x = panel.querySelector('.rna-x');
                if (x) x.addEventListener('click', tutup);
                document.addEventListener('keydown', function (ev) {
                    if (!panel.classList.contains('rna-open')) return;
                    if (ev.key === 'Escape') { ev.preventDefault(); tutup(); return; }
                    if (ev.key !== 'Tab') return;
                    var daftar = fokusable();
                    if (daftar.length === 0) return;
                    var pertama = daftar[0];
                    var terakhir = daftar[daftar.length - 1];
                    if (ev.shiftKey && document.activeElement === pertama) { ev.preventDefault(); terakhir.focus(); return; }
                    if (!ev.shiftKey && document.activeElement === terakhir) { ev.preventDefault(); pertama.focus(); }
                });
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var daftar = document.querySelectorAll('[data-rna-root]');
        for (var i = 0; i < daftar.length; i++) pasang(daftar[i]);
    });
})();

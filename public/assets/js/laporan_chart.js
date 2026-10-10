/*
    Grafik Laporan Penjualan — revisi #19 (4 model) & #22 (per mobil BK / per armada).
    Data disuntik dari Blade pada <script id="dataGrafikLaporan">.
    Model: batang (bar), garis (line), lingkaran (doughnut), radar.
    Sumber data: per mobil (BK), per armada (jenis), per kota, per reservasi.
*/
(function () {
    var blok = document.getElementById('dataGrafikLaporan');
    var kanvas = document.getElementById('grafikLaporan');
    if (!blok || !kanvas) { return; }
    if (typeof Chart === 'undefined') {
        /* Pustaka gagal dimuat — jangan biarkan kanvas kosong diam-diam. */
        var judulErr = document.getElementById('grafikLaporanJudul');
        if (judulErr) { judulErr.textContent = 'Grafik tidak dapat dimuat (Chart.js gagal dimuat). Muat ulang halaman.'; }
        return;
    }

    var data;
    try { data = JSON.parse(blok.textContent || '{}'); } catch (e) { return; }

    var labelSumber = {
        mobil: 'Per mobil (BK)',
        armada: 'Per armada (jenis)',
        kota: 'Per kota pelayanan',
        reservasi: 'Per reservasi'
    };
    var labelModel = { bar: 'Batang', line: 'Garis', doughnut: 'Lingkaran', radar: 'Radar' };

    /* Warna dibaca dari token CSS setiap kali menggambar, supaya ikut tema.
       Lihat public/assets/js/tema.js dan token --chart-* di app.css. */
    var T = window.RNTema || null;
    function warna(nama, cadangan) { return T ? T.warna(nama, cadangan) : cadangan; }
    function alfa(hex, a) { return T ? T.alfa(hex, a) : hex; }
    function paletKategori() {
        return T ? T.palet() : ['#d81f26', '#2563eb', '#0f9d58', '#ea7c1f', '#7c3aed', '#0d9488',
            '#db2777', '#64748b', '#ca8a04', '#0891b2', '#8b5cf6', '#65a30d'];
    }

    var sumber = 'mobil';
    var model = 'bar';
    var grafik = null;

    function ringkas(n) {
        n = Number(n) || 0;
        if (n >= 1000000000) { return (n / 1000000000).toFixed(1) + ' M'; }
        if (n >= 1000000) { return (n / 1000000).toFixed(1) + ' jt'; }
        if (n >= 1000) { return (n / 1000).toFixed(0) + ' rb'; }
        return String(n);
    }

    function isiTerpilih() { return data[sumber] || []; }

    /* Sinkronkan kelas .active + aria-pressed semua tombol dengan state kini. */
    function sinkronTombol() {
        document.querySelectorAll('[data-grafik-sumber]').forEach(function (x) {
            var on = x.getAttribute('data-grafik-sumber') === sumber;
            x.classList.toggle('active', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        document.querySelectorAll('[data-grafik-model]').forEach(function (x) {
            var on = x.getAttribute('data-grafik-model') === model;
            x.classList.toggle('active', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function gambar() {
        var isi = isiTerpilih();
        var lingkaran = (model === 'doughnut');
        var radar = (model === 'radar');

        var merah = warna('--primary', '#d81f26');
        var palet = paletKategori();
        var kisiWarna = warna('--chart-grid', '#f0f1f3');
        var tickWarna = warna('--chart-tick', '#5b6270');

        var latar = alfa(merah, 0.85);
        var tepi = merah;
        if (lingkaran) { latar = palet; tepi = warna('--chart-border', '#ffffff'); }
        if (radar) { latar = alfa(merah, 0.25); tepi = merah; }

        var opsi = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: lingkaran || radar, position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (item) {
                            var d = isi[item.dataIndex] || {};
                            var ket = 'Jumlah: ' + (d.jumlah !== undefined ? d.jumlah : '-');
                            /* Format ikut sumbu (ringkas), bukan rupiah penuh — satu format angka. */
                            return labelModel[model] === 'Lingkaran'
                                ? item.label + ': ' + ringkas(item.parsed)
                                : labelSumber[sumber] + ': ' + ringkas(item.parsed.y !== undefined ? item.parsed.y : item.parsed) + ' | ' + ket;
                        }
                    }
                }
            }
        };

        if (lingkaran) {
            opsi.cutout = '45%';
        } else if (radar) {
            opsi.scales = { r: { beginAtZero: true, ticks: { callback: function (v) { return ringkas(v); } } } };
        } else {
            opsi.scales = {
                y: { beginAtZero: true, ticks: { callback: function (v) { return ringkas(v); }, color: tickWarna }, grid: { color: kisiWarna } },
                x: { ticks: { color: tickWarna, maxRotation: 60, minRotation: 0 }, grid: { display: false } }
            };
        }

        if (grafik) { grafik.destroy(); }

        grafik = new Chart(kanvas, {
            type: lingkaran ? 'doughnut' : model,
            data: {
                labels: isi.map(function (x) { return x.label; }),
                datasets: [{
                    label: labelSumber[sumber],
                    data: isi.map(function (x) { return x.nilai; }),
                    backgroundColor: latar,
                    borderColor: tepi,
                    borderWidth: (lingkaran || radar) ? 1 : 0,
                    fill: radar,
                    tension: 0.3,
                    pointRadius: model === 'line' ? 3 : 0
                }]
            },
            options: opsi
        });

        var kosong = document.getElementById('grafikLaporanKosong');
        if (kosong) { kosong.style.display = isi.length ? 'none' : 'block'; }
        var judul = document.getElementById('grafikLaporanJudul');
        if (judul) { judul.textContent = labelSumber[sumber] + ' — model ' + labelModel[model]; }
        sinkronTombol();
    }

    document.querySelectorAll('[data-grafik-sumber]').forEach(function (b) {
        b.addEventListener('click', function () {
            sumber = b.getAttribute('data-grafik-sumber');
            gambar();
        });
    });
    document.querySelectorAll('[data-grafik-model]').forEach(function (b) {
        b.addEventListener('click', function () {
            model = b.getAttribute('data-grafik-model');
            gambar();
        });
    });

    /* Ganti tema -> gambar ulang. Hanya listener ini yang ditambah;
       skrip TIDAK dijalankan ulang, supaya listener tombol tidak berganda. */
    document.addEventListener('rn:themechange', gambar);

    gambar();
})();

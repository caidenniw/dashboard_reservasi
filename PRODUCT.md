# Product

## Register

product

## Users

Tim operasional 1000 Nusantara Rental (rental armada mobil). Tiga peran, dengan kebutuhan berbeda:

- **reservasi** — menerima pesanan pelanggan, memasukkan data order, mengatur unit & driver. Ini pengguna terberat. Bekerja cepat, sering sambil berhadapan dengan pelanggan atau membaca pesan WhatsApp. **Tidak boleh melihat harga modal atau margin.**
- **finance** — menerbitkan invoice final, mencatat pembayaran, memeriksa piutang. Butuh ketelitian angka.
- **superadmin** — mengelola master data (armada, driver, pelanggan, vendor, wilayah, kota, include), user, dan pengaturan. Melihat semuanya.

Konteks pemakaian: **campuran desktop dan mobile**. Admin di kantor dengan layar lebar; staf lapangan membuka dari HP. Keduanya harus nyaman. Di HP, tabel padat harus tetap terbaca tanpa menggeser ke samping.

## Product Purpose

Dashboard internal pengganti aplikasi PHP lama, untuk mengelola reservasi armada: dari pesanan masuk, penetapan unit & driver, penerbitan invoice, sampai laporan penjualan dan bagi hasil per reservasi.

Tugas utama di setiap layar:
- **Beranda** — apa yang sedang terjadi hari ini? (pesanan berjalan, unit keluar, invoice belum lunas)
- **Data Pesanan** — temukan pesanan tertentu dengan cepat, lalu buka detailnya
- **Input Pesanan** — masukkan order baru secepat mungkin, sering dari tempel teks WhatsApp
- **Laporan** — berapa penjualan dan margin periode ini, per mobil/armada/kota/reservasi

Sukses berarti: staf menemukan informasi lebih cepat daripada di aplikasi lama, dan angka tidak pernah salah baca.

## Brand Personality

**Tegas, terstruktur, tenang.**

Alat kerja yang menghilang ke dalam tugas. Bukan tempat untuk berekspresi; tempat untuk bekerja cepat dan tidak ragu. Nada bahasa Indonesia yang lugas dan netral — istilah operasional apa adanya ("Sisa Tagihan", "Panjar", "Unit bertugas"), bukan istilah teknis atau bahasa pemasaran.

Identitas visual: merah korporat 1000 Nusantara sebagai warna aksi utama, di atas netral yang tenang. Emas dipakai **hanya** untuk menandai dokumen formal (invoice FINAL, status Lunas) — warna itu sudah menjadi milik kop invoice, jadi pemakainya di aplikasi menyambung makna yang sudah ada, bukan menambah hiasan.

## Anti-references

- **Dashboard "SaaS generik"** — kartu identik berulang, angka besar dengan label kecil dan gradien, ikon dekoratif di tiap kotak. Ciri template, bukan alat kerja.
- **Tampilan lama aplikasi ini sendiri** — sidebar gelap bergradien, teks abu terang di atas gelap, banyak bayangan dan baris berlebih. Itu yang sedang ditinggalkan.
- **Keramaian warna** — semua status berwarna cerah sekaligus, sehingga tidak ada yang menonjol. Warna harus punya arti; kalau semua penting, tidak ada yang penting.
- **Animasi yang memperlambat** — transisi panjang, elemen masuk satu per satu. Staf sedang bekerja, bukan menonton.
- **Tabel yang harus digeser ke samping di HP** — memaksa pengguna lapangan memakai cara desktop.

## Design Principles

1. **Angka tidak boleh salah baca.** `tabular-nums` di semua angka. Kolom uang rata kanan. Nomor order tidak boleh patah di tengah. Pemisah ribuan konsisten.
2. **Kepadatan yang teratur, bukan sesak.** Banyak data itu memang perlu. Yang dihindari bukan kepadatan, tapi ketidakjelasan: garis berlebih, spasi tidak konsisten, hierarki kabur.
3. **Kedalaman dari garis, bukan bayangan.** Batas 1px dan permukaan bertingkat membawa struktur. Bayangan hanya untuk yang benar-benar melayang (modal, dropdown).
4. **Setiap warna punya satu arti.** Merah = aksi utama. Emas = dokumen formal. Amber = tindakan manual. Hijau = selesai. Satu arti per warna, konsisten di seluruh aplikasi.
5. **Terang dan gelap setara.** Bukan tema gelap sebagai tambahan, tapi dua tema yang sama-sama dirancang. Setiap token punya nilai di keduanya.
6. **Hak akses terlihat sebagai absen, bukan terkunci.** Kalau reservasi tidak boleh melihat margin, kolomnya tidak ada — bukan ada tapi disensor. Lebih bersih dan tidak membocorkan keberadaan data.

## Accessibility & Inclusion

- **Kontras WCAG AA** — teks isi ≥4.5:1 di kedua tema. Token `--ink-soft` dan `--accent-gold-ink` dipilih khusus untuk memenuhi ini; `--accent-gold` (#FFC000) **tidak pernah** dipakai sebagai teks di atas putih (hanya ~1.6:1).
- **Status tidak hanya lewat warna** — badge status memakai label teks, tidak hanya warna. Papan kalender memakai warna per-pembuat, jadi **warna tidak boleh jadi satu-satunya pembeda**; sel juga memuat inisial nama.
- **`prefers-reduced-motion` dihormati** — semua transisi dimatikan bagi yang meminta.
- **Target sentuh di HP** — kontrol utama cukup besar untuk jari, karena staf lapangan memakai HP.
- **Bahasa** — seluruh antarmuka berbahasa Indonesia.

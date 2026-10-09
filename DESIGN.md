# Design

Sistem visual Dashboard Reservasi 1000 Nusantara. Semua nilai hidup di
`src/styles/app.css` sebagai CSS custom property. **Ubah di sana, jangan
hardcode di view atau JS.** (Berkas itu dibundel lewat `src/app/globals.css`;
`public/assets/` hanya menyimpan gambar, font, vendor, dan skrip JS lama.)

## Theme

Dua tema, setara. Terang adalah default; gelap diaktifkan lewat atribut
`data-bs-theme="dark"` di `<html>`, dipilih pengguna (tersimpan di
`localStorage.rn_theme`) atau mengikuti pengaturan OS.

Skrip anti-FOUC (`src/lib/skrip-tema.ts`, disuntik lewat `next/script` di
`src/app/layout.tsx`) memasang atribut itu **sebelum paint pertama**.

Seluruh warna tema berasal dari token di `app.css`; CSS Bootstrap **tidak** dimuat lagi (yang
tersisa hanya JS-nya, `public/assets/vendor/bootstrap/bootstrap.bundle.min.js`, untuk perilaku
komponen lama). Blok `[data-bs-theme="dark"]` menimpa token semantik, dan karena utility Tailwind
dipetakan balik ke token itu (`@theme inline`), komponen ikut bertema sendiri.

**Sidebar mengikuti tema.** Tema terang memakai bidang permukaan terang
(`--sidebar-bg` = `--n-0`), tema gelap memakai permukaan gelap
(`--sidebar-bg` = `--surface`); tinta `--sidebar-ink-*` diturunkan dari token
semantik tema masing-masing. Menu aktif berupa pil tint `--primary-subtle`
dengan teks `--primary-d` di tema terang, dan `--danger-ink` di tema gelap
(teks `--primary-d` di atas tint gelap hanya ≈3.1:1, di bawah ambang AA).
Token `--sidebar-*` karena itu didefinisikan dua kali: di `:root` (terang) dan
di `[data-bs-theme="dark"]` (gelap).

**Menu = pohon bertingkat.** `src/config/menu.ts` berisi daftar top-level
(grup punya `anak?: ItemMenu[]`); grup dirender sebagai tombol akordeon
`.nav-group` (chevron berputar, `aria-expanded`), anak sebagai `.nav-sub`
dengan garis kiri hierarki. Grup yang membungkus menu aktif terbuka otomatis
(mount + saat rute berganti) dan diberi kelas `has-active`. Visibilitas
peran selalu dihitung per leaf lewat `menuTampil()`; grup tampil bila
minimal satu anak tampil.

## Color

Dua lapis. **Primitif** = tangga warna mentah, jangan dipakai langsung.
**Semantik** = yang dipakai komponen.

### Primitif

| Grup | Token |
|---|---|
| Netral (ivory hangat) | `--n-0 --n-25 --n-50 --n-100 --n-150 --n-200 --n-300 --n-400 --n-500 --n-600 --n-700 --n-800 --n-900` |
| Merah | `--red-50 --red-100 --red-200 --red-500 --red-600 --red-700` |
| Emas | `--gold-100 --gold-300 --gold-500 --gold-700 --gold-900 --gold-ink-on` |

Netral memakai keluarga **hangat (ivory)** — hue ≈ 40°, chroma sangat rendah. Latar terasa
seperti kertas, bukan layar. `--gold-700` digelapkan ke `#856111` agar lolos WCAG sebagai teks
di atas ivory (nilai lama `#a97a12` hanya 3.40:1).

### Semantik (terang → gelap)

| Token | Terang | Gelap | Guna |
|---|---|---|---|
| `--bg` | `#f4f1ea` | `#141210` | latar aplikasi (ivory) |
| `--surface` | `#fffdf8` | `#1c1916` | kartu, panel, topbar |
| `--surface-2` | `#faf7f0` | `#221e1a` | kepala tabel, blok bersarang |
| `--surface-3` | `#ede9df` | `#282320` | hover, kontrol tenang |
| `--line` | `#e4dfd2` | `#302a25` | garis utama |
| `--line-strong` | `#d6d0c0` | `#3e3730` | batas kontrol form |
| `--line-subtle` | `#ede9df` | `#282320` | garis pemisah dalam |
| `--ink` | `#1a1815` | `#f5f2ec` | teks utama |
| `--ink-soft` | `#5c564a` | `#a8a096` | teks sekunder |
| `--ink-faint` | `#6f6858` | `#918a7e` | placeholder, teks redup |
| `--primary` | `#d81f26` | `#ef4147` | aksen: teks/ikon di atas latar aplikasi |
| `--primary-fill` | `#d81f26` | `#d81f26` | **latar berisi dengan teks putih** (tombol, chip aktif, avatar) |
| `--on-primary` | `#ffffff` | `#ffffff` | **teks di atas `--primary-fill`** (putih murni, bukan ivory) |
| `--primary-d` | `#b3161c` | `#d81f26` | hover/aktif |
| `--primary-subtle` | `rgba(216,31,38,.07)` | `rgba(239,65,71,.12)` | latar lembut |
| `--primary-ring` | `rgba(216,31,38,.16)` | `rgba(239,65,71,.28)` | focus ring |
| `--danger` | `#d81f26` | `#ef4147` | destruktif |
| `--danger-ink` | `#b3161c` | `#fca5a5` | teks merah di atas `--danger-soft` |
| `--accent-gold` | `#ffc000` | `#ffc000` | **isian/band saja** — jangan jadi teks |
| `--accent-gold-ink` | `#856111` | `#f0c451` | teks/ikon emas di latar aplikasi |
| `--accent-gold-soft` | `#fdf4dd` | `rgba(255,192,0,.14)` | latar badge emas |
| `--accent-gold-line` | `#e8cf94` | `rgba(255,192,0,.32)` | batas badge emas |
| `--accent-gold-dark` | `#1a1410` | `#1a1410` | **teks di atas isian emas** (putih = 1.64:1, gagal) |
| `--accent-gold-bright` | `#ffe89a` | `#ffe89a` | aksen emas di atas latar **gelap/merah** |
| `--sidebar-bg` | `#fffdf8` | `#fffdf8` | sidebar — **terang di kedua tema** |
| `--shadow-sm/-/-md/-lg` | hitam 4–10% | hitam 40–60% | elevasi |

Grafik: `--chart-1` … `--chart-12`, `--chart-grid`, `--chart-tick`, `--chart-border`.

> **Warna grafik wajib HEX.** Chart.js 4.4.1 memakai `@kurkle/color` yang tidak
> mendukung `oklch()`. Nilai oklch akan gagal dirender ke canvas.

### Arti warna (satu arti per warna)

**Aturan payung: emas = struktur, merah = aksi.** Emas menandai struktur & identitas dokumen —
tidak pernah dipakai untuk tombol, link, atau navigasi yang bisa diklik. Merah satu-satunya
warna untuk tindakan.

- **Merah `--primary`** — aksen: teks/ikon/batas di atas latar aplikasi.
- **Merah `--primary-fill`** — latar berisi yang di atasnya ada teks `--on-primary` (putih).
  **Selalu pakai ini, bukan `--primary`,** untuk tombol primary, chip aktif, dan
  avatar. Menu aktif memakai tint `--primary-subtle` + teks `--primary-d` (lihat Sidebar). Di tema gelap `--primary` lebih terang (#ef4147) supaya terbaca sebagai aksen, dan
  teks putih di atasnya hanya 3.81:1 (gagal WCAG). `--primary-fill` tetap #d81f26 di kedua
  tema → 5.07:1.
- **`--on-primary` selalu `#ffffff`** — jangan diganti ivory/`--surface`. Ivory di atas merah
  hanya 4.49:1 (gagal AA); putih 5.07:1.
- **Emas `--accent-gold-ink`** — teks/ikon emas di atas latar terang (5.01:1 di ivory).
- **Emas `--accent-gold`** — hanya isian/band padat (kop invoice cetak, penanda `.card-title`).
  Di atas ivory nilainya 1.46:1, jadi **tidak boleh** jadi teks atau garis
  tipis di latar terang.
- **Emas `--accent-gold-dark`** — teks di atas isian emas. Putih di atas emas cuma 1.64:1.
- **Emas `--accent-gold-bright`** — aksen emas di atas latar gelap (tema gelap).
  Emas murni di atas merah hanya 3.09:1.
- **Badge status: 6 tahap siklus hidup.** Kelas `.pill-*` **tidak boleh di-rename** — dipilih
  `src/lib/format.ts` (`PETA_BADGE` lewat `statusBadgeClass`) dari status. Pemetaannya sudah tepat per tahap:

  | Kelas | Tahap | Status |
  |---|---|---|
  | `.pill-slate` | belum jadi pesanan / ditutup | draft, inquiry, reported, closed |
  | `.pill-blue` | sudah dipesan / dokumen terbit | quoted, booked, invoiced, terbit |
  | `.pill-amber` | menunggu uang | waiting_dp, sebagian |
  | `.pill-cyan` | sedang berjalan | in_trip |
  | `.pill-green`, `.pill-gold` | beres / dokumen terkunci | completed, paid, lunas, FINAL |
  | `.pill-red` | batal | cancelled, batal |

  Emas & merah tetap pegang arti lamanya (emas = uang/dokumen beres, merah = batal). Empat warna
  lain sengaja **diredam** (`--st-info/-tunggu/-jalan`): kalau biru atau teal sekuat emas, emas
  kehilangan perannya sebagai penanda "uang beres". Warna menandai TAHAP; emas menandai HASIL.
- **Amber = tindakan manual, bukan dokumen.** `.kal-sel.manual` memakai amber literal
  `#f59e0b`; `.kal-tag-manual` memakai token `--st-tunggu` (keluarga amber yang sama, sudah
  punya pasangan tema gelap). Keduanya sengaja dibedakan dari emas dokumen: amber = tindakan
  manual, emas = status dokumen. `.rn-terisi` (sorotan parsing) memakai token amber
  `--st-tunggu-bg` + garis `--st-tunggu-line` (ikut tema).
  Teks di atas amber wajib gelap (`--gold-ink-on` = `#1a1410`); putih di atasnya hanya 2.15:1.
- **Papan status Beranda** (`.papan-kartu`) berupa 12 kartu KPI ringkas; latar & teks memakai
  pasangan token keluarga pill-nya lewat atribut `data-fam` (slate/biru/amber/teal/emas/merah)
  — semua pasangan sudah lolos AA. `data-status` dan tautan `?status=` tetap kontrak.
  Angka utama `--ink` supaya paling terbaca; nilai rupiah memakai warna keluarganya.

## Typography

Satu keluarga: **Inter** (variable, self-host di `public/assets/fonts/inter-var.woff2`).
UI produk tidak butuh pasangan display/body. Skala **rem tetap**, bukan clamp —
UI dilihat pada DPI konsisten.

| Ukuran | Dipakai untuk |
|---|---|
| 26px | `.page-hero` (judul besar halaman) |
| 18px | `.page-title` |
| 15.5px | `.modul-judul` (judul kartu modul) |
| 15px | total ringkasan (`.ringkas-row`), `.card-title`, `.rn-modal-pesan`, isi utama |
| 13.5px | kontrol form |
| 13px | isi tabel, `.btn`, `.modul-desc` |
| 12.5px | label form, chip, tombol kecil |
| 12px | `.muted`, `.panel-meta`, teks mikro (`.page-eyebrow`, `.sidebar-slogan`, `.form-text`, `.brand-sub`, `.user-role-badge`, label `data-label` kartu-hp, isi kalender `.kal-tabel`/`.kal-nama`/`.kal-sel`, label grafik & picker) — **lantai ukuran teks: jangan di bawah 12px** |
| 11.5px | kepala tabel, `.badge-pill` (pengecualian sadar: ruang padat, kontras sudah AA) |

**Hierarki halaman: eyebrow → judul → deskripsi.** `.page-eyebrow` 12px/700 huruf besar
(merah), `.page-hero` 26px/750, `.page-sub` 14px — pola pembuka tiap halaman menu.
Judul kartu modul `.modul-judul` 15.5px/700 di atas deskripsi 13px.
Teks/angka memakai `--ink` (16.56:1, AAA), **bukan emas**: keterbacaan menang atas
identitas. Emas tetap ada di `.card-title::before` dan kop invoice cetak.

Aturan:
- `font-variant-numeric: tabular-nums` untuk **semua** angka (tabel, stat, ringkasan)
- `.mono` (Cascadia/Consolas) untuk nomor order, nopol, nomor invoice
- `td.mono { white-space: nowrap }` — nomor order tidak boleh patah di tengah
- Jangan pakai font display untuk label, tombol, atau data
- Ikon: `stroke-width: 1.7` (bukan default Lucide 2) dan 20px untuk menu. Aturan
  `svg[stroke-width]` di `app.css` menimpa atribut presentasi SVG, jadi ikon di
  `src/config/menu.ts` tidak perlu disentuh.

## Ikon

Ikon berasal dari set **Lucide**, ditanam inline sebagai `<svg>` di tiga tempat:
`src/components/sidebar.tsx`, `src/config/menu.ts` (item menu),
`src/components/widget-asisten.tsx`.

- Ketebalan diatur CSS: `svg[stroke-width] { stroke-width: 1.7 }` — atribut presentasi SVG
  bisa ditimpa CSS dan nilainya diwariskan ke path anak.
- Ukuran menu 20px di dalam tile 32px. Kalau diubah, aturan `.nav-item .nav-icon`
  (flex/width/height) **wajib** ikut diubah, kalau tidak SVG-nya terpotong.
- Warna ikon selalu `currentColor` — ikut warna teks di sekitarnya.

## Layout

- Aplikasi: `.app` → flex; sidebar `--sidebar-w` 260px sticky + `.content` flex-1
- Konten: `.page` padding 28/32/56px (16/18/40 di layar kecil)
- Grid tanpa breakpoint: `repeat(auto-fit, minmax(Npx, 1fr))` — `.kpi-grid` pakai 210px
- 2D pakai Grid, 1D pakai flex. Jangan default ke Grid saat flex-wrap lebih sederhana
- Skala z-index **semantik** (`--z-sticky` 100, `--z-dropdown` 500, `--z-sidebar` 1000, `--z-backdrop` 1040, `--z-drawer` 1050, `--z-modal` 1060, `--z-toast` 1080, `--z-tooltip` 1090). Jangan angka ad-hoc (z 1/2/3 di `.kal-tabel` = stacking lokal tabel, sengaja di luar skala)

Breakpoint: 991px (sidebar → offcanvas), 767px (tabel → kartu), 576px (mobile rapat).

## Shape

| Token | Nilai | Dipakai |
|---|---|---|
| `--radius-ctl` | 8px | tombol, input, select, chip, blok kecil |
| `--radius-card` | 14px | kartu, modal, dropdown |
| `--radius-pill` | 999px | badge, user-chip |

Kedalaman: **garis dulu, bayangan belakangan.** Kartu memakai `border: 1px var(--line)` +
`--shadow-card` (lapis sangat tipis). Bayangan lebih kuat hanya untuk yang melayang betulan
(modal `--shadow-lg`, dropdown `--shadow-md`).

## Motion

`--motion-fast` 120ms, `--motion-med` 180ms, easing `--ease-ui` `cubic-bezier(.2,.8,.2,1)`.
Ease-out eksponensial; tanpa bounce, tanpa elastic.

Motion hanya menyampaikan keadaan: hover, fokus, buka/tutup, umpan balik. **Tanpa animasi
masuk berurutan saat halaman dimuat** — pengguna sedang bekerja.

`@media (prefers-reduced-motion: reduce)` mematikan semuanya. Wajib dipertahankan.

## Components

Setiap kontrol interaktif punya keadaan: default, hover, focus-visible, active, disabled.
Keadaan `:focus-visible` memakai `outline: 2px solid var(--primary)` + `outline-offset: 2px`.

Daftar lengkap ada di `src/styles/app.css`. Yang paling sering dipakai:

**Header halaman** `.page-head` `.page-eyebrow` `.page-hero` `.page-sub` · **Panel** `.panel-head` `.panel-meta` · **Wadah** `.card-box` `.card-title` · **Tabel** `.table-wrap` `.tabel` `.table-kosong` · **Badge** `.badge-pill` + `.pill-green/-blue/-amber/-red/-slate/-cyan` · **Form** `.form-grid` `.form-label` `.wajib` `.form-control` `.form-select` `.form-text` · **Langkah** `.section-step` `.step-no` `.step-title` · **Ringkasan** `.ringkas` `.ringkas-row` (`.total` `.margin`) · **Unit** `.item-unit` `.item-head` · **Tombol** `.btn` `.btn-primary` `.btn-outline-secondary` `.btn-outline-danger` `.btn-sm` · **Navigasi** `.sidebar` `.nav-group` `.nav-sub` `.nav-item` (`.active` `.sub`) `.periode-chip` · **Peta modul** `.modul-seksi` `.modul-grid` `.modul-kartu` `.modul-ikon` · **Modal** `.rn-modal` dst. · **Utilitas** `.mono` `.muted` `.text-soft` `.dl-2` `.baris-aksi` `.num`

### Tabel → kartu di HP

Tabel padat berubah jadi kartu bertumpuk di bawah 768px. Pemakaian:

```html
<table class="tabel kartu-hp">
  ...
  <td data-label="No. Order" class="mono">BK1001RN</td>
  <td data-label="Total" class="num">1.050.000</td>
```

`data-label` berisi judul kolom (ambil dari `<th>`). Untuk sel tanpa judul bermakna
(badge, tombol) beri `data-label=""`. Aturan CSS-nya sudah ada di `app.css`, tidak
perlu CSS per halaman.

## Jangan

- Jangan bikin token baru di luar `app.css`
- Jangan pakai warna primitif langsung di komponen — pakai semantik
- Jangan pakai `--accent-gold` sebagai warna teks atau garis tipis di atas latar terang
  (1.46:1) — hanya sebagai isian padat dengan teks `--accent-gold-dark`
- Jangan pakai emas untuk tombol, link, navigasi yang bisa diklik, atau hiasan
- Jangan ganti `--on-primary` jadi ivory/`--surface` — putih murni satu-satunya yang lolos
  di atas `--primary-fill`
- Jangan biarkan sidebar tetap terang di tema gelap — sidebar mengikuti tema (terang di tema terang, gelap di tema gelap)
- Jangan hardcode nilai `--chart-*` di JS — baca lewat `window.RNTema`
- Jangan jalankan ulang skrip grafik untuk ganti tema (listener tombol jadi berganda); pakai listener `rn:themechange` yang sudah ada
- Jangan tambahkan `app.css`/Bootstrap ke `invoice/cetak*` — halaman itu output cetak A4 dan sengaja terisolasi dari tema

# Panduan repo — Dashboard Reservasi 1000 Nusantara Rental

Dashboard internal reservasi armada mobil. **Port Next.js** dari sistem lama (PHP/Laravel) yang
menunjuk **database MySQL yang sama** (`rentalnusantara`). Bahasa UI: Indonesia.

## Tumpukan

| Lapisan | Versi |
|---|---|
| Node.js | 22 |
| Next.js | 16 (App Router, Turbopack) |
| React | 19 |
| TypeScript | 5, strict |
| Tailwind CSS | 4 (utility) + token di `src/styles/app.css` |
| Database | MySQL lewat `mysql2` |
| Sesi | cookie JWT, `jose`, ditandatangani `APP_KEY` |

## Perintah

```bash
npm run dev        # http://localhost:3000
npm run build      # wajib hijau sebelum pekerjaan dianggap selesai
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Sebelum menyatakan pekerjaan selesai: jalankan `npm run typecheck` dan `npm run build`, lalu uji
perubahan di browser (belum ada test otomatis).

## Aturan database (jangan dilanggar)

- Database **sudah ada dan berisi data operasional nyata**, dipakai bersama aplikasi lama.
- **JANGAN** menjalankan DDL dari aplikasi (`CREATE`/`ALTER`/`DROP`). Skema milik sistem lama.
- Tanpa migrasi. Perubahan skema = keputusan terpisah, di luar repo ini.
- Kredensial hanya di `.env` (di-`gitignore`). Jangan menaruh kredensial di kode/commit.

## Konvensi tampilan

- **Token dulu, bukan hardcode.** Warna hidup di `src/styles/app.css` (dua lapis: primitif →
  semantik) dengan pasangan tema lewat `[data-bs-theme]`. `@theme inline` di `src/app/globals.css`
  memetakan utility Tailwind ke token itu (`bg-surface`, `text-ink`, `border-line`, …).
- **Preflight Tailwind tidak dimuat.** Nilai dasar peramban bocor, jadi `a` dan `button` ditambal
  di `src/styles/app.css`. Elemen mentah wajib punya kelas design system.
- Kelas komponen (`card-box`, `tabel`, `badge-pill`, `btn-*`, `alert-*`, `nav-*`) berasal dari
  sistem lama dan **namanya adalah kontrak** — jangan di-rename.
- CSS diorganisasi per area: `app.css` (inti) + `beranda.css`, `master.css`, `pesanan.css`,
  `asisten.css`, diimpor dengan urutan layer `theme < base < components < utilities`.

## Kontrak DOM & skrip lama

- `public/assets/js/*.js` (app.js, scroll-keep, pesanan_form_ext, parse_pesanan, laporan_chart,
  asisten) **dipakai ulang apa adanya**, dimuat `src/components/skrip-muat.tsx`, lalu event
  `DOMContentLoaded` dipancarkan ulang.
- JS lama membaca DOM dengan string persis. Mengganti `id`/`name`/`class`/`data-*` merusak logika
  **tanpa pesan error**. Hook yang dipantau: `scripts/hook-baseline.txt`.
- **Bump `?v=`** setiap kali skrip di `public/assets/js/` berubah (daftarnya di README).

## Hak akses

`src/lib/akses.ts` adalah satu-satunya sumber izin (`roleBoleh`, `menuTampil`, `bolehLihatModal`).
Sidebar, tombol, dan gate halaman membacanya. Jangan menyalin daftar izin.

## Jebakan yang sudah pernah menggigit

- **Next 16**: berkas penjaga rute bernama `src/proxy.ts`, bukan `middleware.ts`.
- **Akses via URL Network (IP LAN)**: tanpa entri di `allowedDevOrigins`, Next memblokir aset dev
  lintas-origin → halaman tampil tapi tidak ter-hidrasi (menu & ganti tema mati). `next.config.ts`
  sudah menambahkan IP LAN otomatis.
- **Bentrok nama kelas Bootstrap vs skala angka Tailwind v4**: `w-100` diartikan
  `width: calc(var(--spacing)*100)` = **400px** (bukan 100%), dan `col-lg-*` tidak terdefinisi.
  Pakai `w-full` / utility Tailwind, atau `.row` + `.col-md-*` yang memang ada di `app.css`.
- **`<select>`**: pakai `defaultValue` pada `<select>`, jangan `selected` pada `<option>`
  (React memperingatkan dan nilainya bisa salah).
- Halaman cetak invoice (`src/app/invoice/[id]/cetak/`) sengaja terisolasi: CSS-nya string sendiri
  (`_css-klasik.ts`, `_css-modern.ts`) dan tidak mengikuti tema aplikasi.

## Struktur

| Path | Isi |
|---|---|
| `src/app/(app)/` | halaman setelah login (shell sidebar + topbar) |
| `src/app/(auth)/` | halaman login, berdiri sendiri |
| `src/app/api/` | endpoint JSON (asisten, parse-pesanan) |
| `src/components/` | sidebar, topbar, modal, widget asisten |
| `src/config/` | menu sidebar, kolom master, peta rute, peta modul |
| `src/lib/` | helper domain (db, sesi, akses, format, settings, server per modul) |
| `src/styles/` | design system |

## Dokumentasi

[`README.md`](README.md) · [`PRODUCT.md`](PRODUCT.md) · [`DESIGN.md`](DESIGN.md)

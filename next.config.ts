import type { NextConfig } from "next";
import os from "node:os";

/*
 * Konfigurasi Next.js untuk Dashboard Reservasi 1000 Nusantara Rental.
 *
 * CATATAN PENTING:
 * - Folder `public/` menyimpan aset statis (gambar, font, vendor, skrip JS lama);
 *   CSS aplikasi TIDAK di sini — berkasnya di `src/styles/` dan dibundel lewat
 *   `src/app/globals.css`. URL yang tetap identik: /assets/img/..., /assets/js/...,
 *   /assets/vendor/..., /assets/fonts/...
 * - `mysql2` dan `exceljs` dijalankan sebagai paket Node eksternal (bukan di-bundle),
 *   karena keduanya bergantung pada modul native/dinamis.
 */

/* Host dev-server yang boleh meminta aset dev (chunk/HMR). Next sudah
   mengizinkan localhost + hostname yang dipakai saat start, tetapi TIDAK
   mengizinkan URL "Network" (IP LAN) — akibatnya chunk diblokir, React tak
   ter-hydrate, dan seluruh menu/tombol mati (termasuk ganti tema).
   IP dibaca saat config dimuat supaya tetap benar walau IP DHCP berubah.
   Entri wajib berupa hostname saja, tanpa skema dan tanpa port. */
const ipLokal = Array.from(
  new Set(
    Object.values(os.networkInterfaces())
      .flatMap((daftar) => daftar ?? [])
      .filter((n) => n.family === "IPv4" && !n.internal)
      .map((n) => n.address),
  ),
);

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "exceljs"],
  allowedDevOrigins: ["127.0.0.1", ...ipLokal],
  // Matikan indikator dev-tools ("N" di kiri bawah) — hanya muncul saat
  // `next dev` dan mengganggu pengecekan UI. Tidak memengaruhi production.
  devIndicators: false,
};

export default nextConfig;

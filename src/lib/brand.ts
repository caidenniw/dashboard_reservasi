/*
 * Nama aplikasi & brand — sumber tunggal.
 * Nilai ini muncul di <title>, sidebar, dan halaman login (port config('app.name')/config('app.sub')).
 */
export const APP_NAME = process.env.APP_NAME ?? "1000 Nusantara Rental";
export const APP_SUB = process.env.APP_SUB ?? "Dashboard Reservasi";
export const APP_PT = "PT. Seribu Nusantara Rental";
export const APP_PT_KAPITAL = APP_PT.toUpperCase();

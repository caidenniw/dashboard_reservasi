/*
 * ESLint flat config (ESLint 9). `eslint-config-next` v16 sudah mengekspor
 * flat config, jadi tidak perlu FlatCompat.
 *
 * Diabaikan:
 * - `.next/`, `node_modules/` — hasil build/dependensi.
 * - `public/assets/` — skrip lama & vendor yang dipakai ulang apa adanya
 *   (skrip klasik browser, bukan modul; bukan milik lint ini).
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        ignores: [".next/**", "node_modules/**", "public/assets/**"],
    },
    {
        rules: {
            /*
             * Navigasi internal sengaja memakai <a> biasa, bukan <Link>: setiap
             * perpindahan halaman adalah muat dokumen penuh, sehingga skrip lama di
             * public/assets/js (app.js dkk.) menginisialisasi ulang dari awal dan
             * pemulihan posisi scroll (scroll-keep.js) tetap konsisten. Markup ini
             * juga hasil port 1:1 dari sistem lama. Menggantinya dengan <Link>
             * mengubah siklus hidup itu — jadi aturannya dimatikan secara sadar,
             * bukan dilanggar tanpa disadari.
             */
            "@next/next/no-html-link-for-pages": "off",
            /*
             * Tiga efek di src/components menyinkronkan state dengan sumber di luar
             * React yang tidak tersedia saat render: mode sidebar dari localStorage
             * + MutationObserver (sidebar.tsx), grup menu induk yang dibuka menurut
             * menu aktif (sidebar.tsx), dan reset judul halaman saat rute berubah
             * (judul-halaman.tsx). Setter-nya dijaga (idempoten), jadi efek adalah
             * tempat yang tepat. Aturan ini adalah panduan performa, bukan temuan bug.
             */
            "react-hooks/set-state-in-effect": "off",
        },
    },
];

export default eslintConfig;

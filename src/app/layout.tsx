import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SKRIP_TEMA_AWAL } from "@/lib/skrip-tema";

/*
 * Layout akar — menyediakan <html>/<body>, tema anti-FOUC, dan aset dasar.
 * Sidebar/topbar TIDAK di sini: halaman login berdiri sendiri (lihat grup (auth)),
 * sedangkan halaman aplikasi memakai shell di grup (app).
 */

export const metadata: Metadata = {
    title: {
        default: "Dashboard Reservasi",
        template: `%s · ${process.env.APP_SUB ?? "Dashboard Reservasi"}`,
    },
    icons: {
        icon: [
            { url: "/assets/img/favicon.png", type: "image/png" },
            { url: "/favicon.ico" },
        ],
    },
};

export const viewport: Viewport = {
    themeColor: "#d81f26",
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="id" data-bs-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
            <body>
                {/* Skrip anti-FOUC: pasang tema & sidebar lipat SEBELUM paint pertama.
                    next/script (beforeInteractive) menyuntiknya ke HTML awal, jadi
                    berjalan sebelum paint — tanpa elemen <script> mentah di React. */}
                <Script id="rn-tema-awal" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_AWAL }} />

                {/* CSS: satu bundel lewat globals.css (Tailwind v4 + design system app.css).
                    Dulu dua <link> mentah; kini diproses bundler, jadi tanda ?v= tak perlu lagi. */}

                {children}

                {/* RNTema — sumber tunggal warna tema untuk grafik & tombol ganti tema. */}
                <Script src="/assets/js/tema.js?v=20261004f" strategy="beforeInteractive" />
            </body>
        </html>
    );
}

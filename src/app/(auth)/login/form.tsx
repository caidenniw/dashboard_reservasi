"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type HasilLogin } from "./actions";
import { APP_NAME, APP_SUB } from "@/lib/brand";

/*
 * Halaman masuk — port 1:1 dari resources/views/auth/login.blade.php.
 * Berdiri sendiri (tanpa sidebar/topbar). Struktur & kelas CSS dipertahankan.
 */

function TombolMasuk() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn btn-primary w-full" id="btnMasuk" disabled={pending}>
            {pending ? "Memproses..." : "Masuk"}
        </button>
    );
}

export default function HalamanLogin({ next }: { next: string }) {
    const [state, formAction] = useActionState<HasilLogin, FormData>(loginAction, {});
    const [tampilSandi, setTampilSandi] = useState(false);

    function alihSandi() {
        setTampilSandi((v) => !v);
        document.getElementById("password")?.focus();
    }

    function gantiTema() {
        const RNTema = (window as unknown as { RNTema?: { ganti: () => void } }).RNTema;
        RNTema?.ganti();
    }

    return (
        <div className="login-page">
            {/* Panel gelap: identitas. */}
            <div className="login-panel">
                <div className="login-identitas">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/img/logo.png" alt={APP_NAME} className="login-logo" />
                    <div>
                        <h1 className="login-produk">{APP_NAME}</h1>
                        <p className="login-produk-sub">{APP_SUB}</p>
                    </div>
                </div>
                <div className="login-pesan">
                    <span className="login-garis" />
                    <p className="login-slogan">Satu Sistem Seribu Perjalanan</p>
                </div>
            </div>

            {/* Sisi form */}
            <div className="login-form-wrap">
                <div className="login-form">
                    <div className="login-head">
                        <div>
                            <h2 className="login-judul">Masuk</h2>
                            <p className="login-judul-sub">Silakan masuk untuk melanjutkan.</p>
                        </div>
                        <button
                            type="button"
                            className="btn-tema"
                            onClick={gantiTema}
                            aria-label="Ganti tema terang/gelap"
                            title="Ganti tema"
                        >
                            <svg className="ikon-gelap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                            <svg className="ikon-terang" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                        </button>
                    </div>

                    {state.pesanSalah && (
                        <div className="login-alert" role="alert">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            <span>{state.pesanSalah}</span>
                        </div>
                    )}

                    <form action={formAction} id="formMasuk">
                        <input type="hidden" name="next" value={next} />
                        <div className="mb-3">
                            <label className="form-label" htmlFor="username">Username</label>
                            <input
                                type="text"
                                className="form-control"
                                id="username"
                                name="username"
                                defaultValue={state.username ?? ""}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div className="kolom-sandi">
                                <input
                                    type={tampilSandi ? "text" : "password"}
                                    className="form-control"
                                    id="password"
                                    name="password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn-sandi"
                                    id="btnSandi"
                                    aria-pressed={tampilSandi}
                                    aria-label={tampilSandi ? "Sembunyikan password" : "Tampilkan password"}
                                    title={tampilSandi ? "Sembunyikan password" : "Tampilkan password"}
                                    onClick={alihSandi}
                                >
                                    <svg className="ikon-sandi-tutup" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                    <svg className="ikon-sandi-buka" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M6.61 6.61A18.15 18.15 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                                </button>
                            </div>
                        </div>
                        <TombolMasuk />
                    </form>
                </div>
            </div>
        </div>
    );
}

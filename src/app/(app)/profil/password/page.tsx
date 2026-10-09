import { harusMasuk } from "@/lib/sesi";

/* Ubah Password — port dari profil/password.blade.php. */
export default async function HalamanUbahPassword() {
    await harusMasuk();

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Akun</span>
                <h1 className="text-3xl font-bold text-ink mt-1">Ubah Password</h1>
                <p className="text-ink-soft mt-2">Perbarui kata sandi akun yang sedang masuk.</p>
            </div>

            <div className="card-box max-w-3xl">
            <h2 className="text-xl font-bold text-ink mb-6">Ubah Password</h2>
            <form method="post" action="/profil/password/simpan" className="space-y-5">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-ink-soft" htmlFor="password_lama">Password Lama</label>
                    <input type="password" className="w-full p-2.5 rounded-lg border border-line-strong bg-surface text-ink focus:ring-2 focus:ring-primary outline-none" id="password_lama" name="password_lama" required autoComplete="current-password" />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-ink-soft" htmlFor="password_baru">Password Baru</label>
                    <input type="password" className="w-full p-2.5 rounded-lg border border-line-strong bg-surface text-ink focus:ring-2 focus:ring-primary outline-none" id="password_baru" name="password_baru" required minLength={6} autoComplete="new-password" />
                    <div className="text-xs text-ink-soft">Minimal 6 karakter.</div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-ink-soft" htmlFor="password_ulang">Ulangi Password Baru</label>
                    <input type="password" className="w-full p-2.5 rounded-lg border border-line-strong bg-surface text-ink focus:ring-2 focus:ring-primary outline-none" id="password_ulang" name="password_ulang" required autoComplete="new-password" />
                </div>
                <button type="submit" className="w-full py-2.5 px-4 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg font-medium transition-colors">Simpan Password</button>
            </form>
        </div>
        </>
    );
}

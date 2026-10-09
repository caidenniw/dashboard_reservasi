import { harusMasuk } from "@/lib/sesi";
import { roleBoleh, DAFTAR_ROLE, type Role } from "@/lib/akses";
import { ambilFlash } from "@/lib/flash-server";
import { queryOne, query } from "@/lib/db";
import { AlertValidasi } from "@/components/alerts";

/*
 * Manajemen User (khusus Super Admin) — port dari user/index.blade.php + UserController.
 */

interface BarisUser {
    id: number;
    username: string;
    nama: string | null;
    role: string | null;
    is_active: number;
}

export default async function HalamanUser({
    searchParams,
}: {
    searchParams: Promise<{ ubah?: string }>;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "user.kelola")) {
        return (
            <div className="p-4 bg-surface border border-line rounded-lg shadow-sm">
                <div className="font-bold text-ink mb-1">Akses ditolak</div>
                <p className="text-ink-soft text-sm">Halaman Manajemen User hanya untuk Super Admin.</p>
            </div>
        );
    }

    const sp = await searchParams;
    const flash = await ambilFlash();
    const users = await query<BarisUser>("SELECT id, username, nama, role, is_active FROM users ORDER BY id");
    const ubah = sp.ubah
        ? await queryOne<BarisUser>(
            "SELECT id, username, nama, role, is_active FROM users WHERE id = ? LIMIT 1",
            [Number(sp.ubah)],
        )
        : null;

    const old = flash.old ?? {};

    return (
        <>
            <div className="mb-6">
                <span className="text-xs font-medium text-ink-soft uppercase tracking-wider">Sistem & Tools · User</span>
                <h1 className="text-3xl font-bold text-ink mt-1 mb-2">Manajemen User</h1>
                <p className="text-ink-soft">Akun, peran, dan hak akses sistem.</p>
            </div>

            <AlertValidasi pesan={flash.error_validasi} />

            <div className="card-box max-w-3xl">
                <h2 className="text-lg font-bold text-ink mb-4">{ubah ? `Ubah Pengguna: ${ubah.username}` : "Tambah Pengguna"}</h2>

                <form method="post" action={ubah ? "/user/perbarui" : "/user/simpan"} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ubah && <input type="hidden" name="id" value={Number(ubah.id)} />}

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="username">Username</label>
                        {ubah ? (
                            <>
                                <input type="text" className="px-3 py-1.5 bg-surface-2 border border-line rounded-md text-sm text-ink cursor-not-allowed" id="username" defaultValue={ubah.username} disabled />
                                <div className="form-text">Username tidak bisa diubah (dipakai untuk masuk).</div>
                            </>
                        ) : (
                            <input type="text" className="px-3 py-1.5 bg-surface border border-line rounded-md text-sm text-ink focus:ring-2 focus:ring-primary focus:border-primary outline-none" id="username" name="username" defaultValue={old.username?.[0] ?? ""} required />
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="nama">Nama tampil</label>
                        <input
                            type="text"
                            className="px-3 py-1.5 bg-surface border border-line rounded-md text-sm text-ink focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            id="nama"
                            name="nama"
                            defaultValue={ubah ? String(ubah.nama ?? "") : (old.nama?.[0] ?? "")}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="role">Peran</label>
                        <select
                            className="px-3 py-1.5 bg-surface border border-line rounded-md text-sm text-ink focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            id="role"
                            name="role"
                            required
                            defaultValue={ubah ? String(ubah.role ?? "reservasi") : (old.role?.[0] ?? "reservasi")}
                        >
                            {Object.entries(DAFTAR_ROLE).map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink-soft" htmlFor="password">
                            {ubah ? "Password baru (kosongkan bila tidak diganti)" : "Password"}
                        </label>
                        <input
                            type="password"
                            className="px-3 py-1.5 bg-surface border border-line rounded-md text-sm text-ink focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            id="password"
                            name="password"
                            required={!ubah}
                            autoComplete="new-password"
                        />
                        <div className="text-xs text-ink-faint mt-1">Minimal 6 karakter.</div>
                    </div>
                    <div className="flex items-center gap-2 py-2">
                            <input
                                className="w-4 h-4 rounded border-line text-primary focus:ring-primary"
                                type="checkbox"
                                value="1"
                                id="is_active"
                                name="is_active"
                                defaultChecked={(ubah ? Number(ubah.is_active) : 1) === 1}
                            />
                            <label className="text-sm text-ink cursor-pointer" htmlFor="is_active">Akun aktif (bisa masuk)</label>
                        </div>
                    <div className="col-span-full">
                        <div className="flex items-center gap-2">
                            <button type="submit" className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary text-sm font-bold rounded-md transition-opacity">
                                {ubah ? "Simpan Perubahan" : "Tambah Pengguna"}
                            </button>
                            {ubah && <a className="px-4 py-2 border border-line text-ink-soft text-sm font-medium rounded-md hover:bg-surface-2 transition-colors" href="/user">Batal</a>}
                        </div>
                    </div>
                </form>
            </div>

            <div className="mt-6 p-6 bg-surface border border-line rounded-xl shadow-sm">
                <h2 className="text-lg font-bold text-ink mb-4">Daftar Pengguna ({users.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <caption className="visually-hidden">Daftar user</caption>
                        <thead>
                            <tr className="border-b border-line bg-surface-2 text-ink-soft font-medium">
                                <th scope="col" className="px-3 py-2 font-semibold">Username</th><th scope="col" className="px-3 py-2 font-semibold">Nama</th><th scope="col" className="px-3 py-2 font-semibold">Peran</th><th scope="col" className="px-3 py-2 font-semibold">Status</th><th scope="col" className="px-3 py-2 font-semibold">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={Number(u.id)} className="border-b border-line hover:bg-surface-3 transition-colors">
                                    <td data-label="Username" className="px-3 py-2 mono">
                                        {u.username}
                                        {Number(u.id) === user.id && <div className="text-xs text-ink-faint italic">(akun kamu)</div>}
                                    </td>
                                    <td data-label="Nama" className="px-3 py-2">{u.nama}</td>
                                    <td data-label="Peran" className="px-3 py-2">{DAFTAR_ROLE[(u.role ?? "") as Role] ?? u.role}</td>
                                    <td data-label="Status" className="px-3 py-2">
                                        {Number(u.is_active) === 1 ? (
                                            <span className="badge-pill pill-green">aktif</span>
                                        ) : (
                                            <span className="badge-pill pill-slate">nonaktif</span>
                                        )}
                                    </td>
                                    <td data-label="Aksi" className="px-3 py-2">
                                        <a className="px-3 py-1 border border-line text-ink-soft text-xs font-medium rounded hover:bg-surface-2 transition-colors" href={`/user?ubah=${Number(u.id)}`}>Ubah</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 p-6 bg-surface border border-line rounded-xl shadow-sm">
                <h2 className="text-lg font-bold text-ink mb-4">Apa yang boleh dilakukan tiap peran</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <dt className="font-bold text-ink">Super Admin (Owner)</dt>
                    <dd className="text-sm text-ink-soft leading-relaxed">Semua: pesanan, invoice (sementara &amp; final), melihat modal/margin/laba, pengaturan faktur, import, kelola user.</dd>
                    <dt className="font-bold text-ink">Admin Reservasi</dt>
                    <dd className="text-sm text-ink-soft leading-relaxed">Input &amp; ubah pesanan, terbitkan invoice, cetak invoice <b className="text-ink">sementara</b>, melihat master. TIDAK melihat modal/margin, TIDAK cetak final, TIDAK import/pengaturan/kelola user.</dd>
                    <dt className="font-bold text-ink">Finance</dt>
                    <dd className="text-sm text-ink-soft leading-relaxed">Melihat data pesanan, mencatat pembayaran, dan mencetak invoice <b className="text-ink">final</b>. TIDAK boleh input/ubah pesanan.</dd>
                </dl>
                <div className="text-xs text-ink-faint italic mt-4">
                    Catatan: peran Super Admin tidak bisa menurunkan peran akunnya sendiri atau menonaktifkan dirinya sendiri,
                    supaya tidak ada kemungkinan terkunci dari sistem.
                </div>
            </div>
        </>
    );
}
import { notFound } from "next/navigation";
import { MASTER } from "@/config/master";
import { harusMasuk } from "@/lib/sesi";
import { bolehLihatModal, roleBoleh } from "@/lib/akses";
import { ambilFlash } from "@/lib/flash-server";
import {
    daftarMaster, ambilMaster, nilaiForm, opsiSemua, saringKolomModal,
} from "@/lib/master-server";
import { AlertValidasi } from "@/components/alerts";
import { FieldMaster } from "./field";
import { NilaiMaster } from "./nilai";

/* Peta warna status config -> kelas badge aplikasi (lihat komentar di Blade). */
const PETA_PILL: Record<string, string> = {
    success: "pill-slate",
    warning: "pill-amber",
    danger: "pill-red",
    dark: "pill-red",
};

export default async function HalamanMaster({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ cari?: string; id?: string }>;
}) {
    const { slug } = await params;
    const cfgAsli = MASTER[slug];
    if (!cfgAsli) {
        notFound();
    }

    const user = await harusMasuk();
    const sp = await searchParams;
    const flash = await ambilFlash();

    /* Revisi #8: angka modal hanya untuk pemilik. Kolom dibuang dari cfg sebelum
       nilaiForm/opsi dibangun, jadi form dan daftar ikut bersih. */
    const cfg = saringKolomModal(cfgAsli, bolehLihatModal(user.role));
    const bolehTulis = roleBoleh(user.role, "master.tulis");

    const cari = (sp.cari ?? "").trim();
    const editRow = await ambilMaster(cfg, Number(sp.id ?? 0) || 0);
    const rows = await daftarMaster(cfg, cari);
    const semuaOpsi = await opsiSemua(cfg);
    const nilai = nilaiForm(cfg, editRow, flash.old ?? {}, semuaOpsi);

    const petaKolom: Record<string, (typeof cfg.kolom)[number]> = {};
    for (const k of cfg.kolom) {
        petaKolom[k.name] = k;
    }
    const urlModul = `/master/${slug}`;
    const aksiSimpan = `/master/${slug}/simpan`;
    const aksiHapus = `/master/${slug}/hapus`;

    return (
        <>
            <div className="page-head mb-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Data Master</span>
                <h1 className="text-3xl font-bold text-ink mt-1">{cfg.judul_halaman}</h1>
                <p className="text-ink-soft mt-2">Kelola referensi data operasional sesuai modul yang dipilih.</p>
            </div>

            <AlertValidasi pesan={flash.error_validasi} />

            {bolehTulis ? (
                <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                    <h2 className="text-xl font-bold text-ink mb-6">
                        {editRow ? `Ubah ${cfg.judul}` : `Tambah ${cfg.judul}`}
                    </h2>
                    <form method="post" action={aksiSimpan} encType="multipart/form-data" className="space-y-6">
                        <input type="hidden" name="aksi" value="simpan" />
                        <input type="hidden" name="id" value={Number(editRow?.id ?? 0)} />
                        <div className="row g-3">
                            {cfg.kolom.map((c) => (
                                <FieldMaster key={c.name} c={c} nilai={nilai[c.name] ?? ""} opsi={semuaOpsi[c.name] ?? []} />
                            ))}
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="submit" className="px-4 py-2 bg-primary-fill hover:bg-primary-d text-on-primary rounded-lg text-sm font-medium transition-colors">Simpan</button>
                            {editRow && (
                                <a className="px-4 py-2 text-sm font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" href={urlModul}>Batal</a>
                            )}
                        </div>
                    </form>
                </div>
            ) : (
                <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm mb-6">
                    <p className="text-sm text-ink-soft">Perubahan dilakukan oleh superadmin.</p>
                </div>
            )}

            <div className="card-box p-6 bg-surface rounded-xl border border-line shadow-sm">
                <div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-ink">Daftar {cfg.judul} ({rows.length})</h2>
                    <form className="flex gap-2" method="get" role="search">
                        <input
                            type="text"
                            className="p-2 rounded-lg border border-line-strong bg-surface text-sm outline-none focus:ring-2 focus:ring-primary"
                            name="cari"
                            defaultValue={cari}
                            aria-label={`Cari ${cfg.judul}`}
                            placeholder={cfg.placeholder ?? "cari data"}
                        />
                        <button className="px-3 py-2 text-xs font-medium rounded-lg border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors" type="submit">Cari</button>
                        {cari !== "" && (
                            <a className="px-3 py-2 text-xs font-medium text-primary hover:underline" href={urlModul}>Reset</a>
                        )}
                    </form>
                </div>
                <div className="overflow-x-auto">
                    <table className="tabel kartu-hp w-full text-sm text-left border-collapse">
                        <caption className="sr-only">Daftar {cfg.judul}</caption>
                        <thead className="bg-surface-2 text-ink-soft">
                            <tr>
                                {cfg.kolom_list.map((nama) => (
                                    <th scope="col" key={nama} className="px-3 py-2 font-semibold border-b border-line">{petaKolom[nama]?.label ?? nama}</th>
                                ))}
                                <th scope="col" className="px-3 py-2 font-semibold border-b border-line">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={cfg.kolom_list.length + 1} className="px-3 py-8 text-center text-ink-soft italic">
                                        <div className="table-kosong">
                                            {bolehTulis ? "Belum ada data. Tambahkan lewat form di atas." : "Belum ada data."}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {rows.map((r) => (
                                <tr key={String(r.id)} className="hover:bg-surface-2 transition-colors">
                                    {cfg.kolom_list.map((nama) => {
                                        const c = petaKolom[nama];
                                        const kelasSel = c?.tipe === "rupiah" ? "text-right" : undefined;
                                        const labelKolom = c?.label ?? "";

                                        if (nama === "status" && cfg.status_map) {
                                            const warna = cfg.warna_status?.[String(r.status)] ?? "";
                                            const pill = PETA_PILL[warna] ?? "pill-slate";
                                            const teks = cfg.status_map[String(r.status)] ?? String(r.status);
                                            return (
                                                <td key={nama} data-label={labelKolom} className={`px-3 py-2 ${kelasSel}`}>
                                                    {warna !== "" ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pill}`}>{teks}</span>
                                                    ) : (
                                                        teks
                                                    )}
                                                </td>
                                            );
                                        }
                                        return (
                                            <td key={nama} data-label={labelKolom} className={`px-3 py-2 ${kelasSel}`}>
                                                {c ? (
                                                    <NilaiMaster c={c} nilai={r[nama]} opsi={semuaOpsi[nama] ?? []} />
                                                ) : (
                                                    String(r[nama] ?? "")
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td data-label="Aksi" className="px-3 py-2">
                                        <div className="flex gap-2">
                                            <a
                                                className="px-2 py-1 text-xs font-medium rounded-md border border-line-strong text-ink-soft hover:bg-surface-2 transition-colors"
                                                href={`${urlModul}?id=${Number(r.id)}${cari !== "" ? "&cari=" + encodeURIComponent(cari) : ""}`}
                                            >
                                                Ubah
                                            </a>
                                            {bolehTulis && (
                                                <form method="post" action={aksiHapus} data-konfirmasi="Nonaktifkan data ini?">
                                                    <input type="hidden" name="aksi" value="hapus" />
                                                    <input type="hidden" name="id" value={Number(r.id)} />
                                                    <button type="submit" className="px-2 py-1 text-xs font-medium rounded-md border border-danger-line text-danger hover:bg-danger-soft transition-colors">Nonaktifkan</button>
                                                </form>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
 }

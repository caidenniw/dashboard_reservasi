import { statusLabel, tglAngka } from "@/lib/format";
import { daftarWarnaReservasi, warnaPembuat } from "@/config/warna-reservasi";
import type { HasilKalender } from "@/lib/beranda-server";

/*
 * Papan ketersediaan unit + driver — port 1:1 dari
 * legacy-laravel/resources/views/beranda/_kalender_unit.blade.php.
 *
 * Class (.kal-*) dan struktur tabel dipertahankan: beranda.css sudah memuat gayanya
 * dan skrip lama tidak menyentuh DOM ini, jadi jangan diubah tanpa alasan.
 */

/** Gabungkan query saat ini dengan nilai baru (pengganti http_build_query(array_merge())). */
function ubahQuery(
    params: Record<string, string | string[] | undefined>,
    ganti: Record<string, string | number>,
): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined) {
            continue;
        }
        for (const satu of Array.isArray(v) ? v : [v]) {
            p.append(k, satu);
        }
    }
    for (const [k, v] of Object.entries(ganti)) {
        p.set(k, String(v));
    }
    return p.toString();
}

export function KalenderUnit({
    k,
    params,
}: {
    k: HasilKalender;
    params: Record<string, string | string[] | undefined>;
}) {
    const kepalaTanggal = k.tanggal.map((t) => (
        <th className={t.akhirPekan ? "kal-libur" : ""} title={tglAngka(t.tgl)} key={t.tgl}>
            {t.hariAngka}<span>{t.namaHari}</span>
        </th>
    ));

    const adaIsi = k.unitTampil.length > 0 || Object.keys(k.manual).length > 0;

    return (
        <div className="card-box">
            <div className="panel-head">
                <h2 className="card-title">Ketersediaan unit ({k.jumlahHari} hari ke depan)</h2>
                <div className="periode-bar">
                    {k.pilihanHari.map(([kh, lh]) => (
                        <a
                            className={`periode-chip ${k.jumlahHari === kh ? "active" : ""}`}
                            href={`/ketersediaan?${ubahQuery(params, { hari: kh, semua: k.tampilSemua ? 1 : 0 })}`}
                            key={kh}
                        >
                            {lh}
                        </a>
                    ))}
                    <a
                        className={`periode-chip ${k.tampilSemua ? "active" : ""}`}
                        href={`/ketersediaan?${ubahQuery(params, { semua: k.tampilSemua ? 0 : 1 })}`}
                    >
                        {k.tampilSemua ? "Hanya yang ada jadwal" : "Tampilkan semua unit"}
                    </a>
                </div>
            </div>

            <form className="periode-form mt-2" method="get" action="/ketersediaan">
                <input type="hidden" name="hari" value={k.jumlahHari} />
                <label htmlFor="unit">Cari unit</label>
                <input
                    type="text"
                    id="unit"
                    name="unit"
                    className="form-control form-control-sm kolom-cari"
                    defaultValue={k.cari}
                    placeholder="nopol atau nama unit"
                />
                <button className="btn btn-sm btn-outline-secondary" type="submit">Cari</button>
                {k.cari !== "" && (
                    <a
                        className="btn btn-sm btn-outline-secondary"
                        href={`/ketersediaan?${ubahQuery(params, { unit: "", semua: 0 })}`}
                    >
                        Reset
                    </a>
                )}
                <span className="form-text mb-0">
                    {k.unitHariIni} unit terisi hari ini dari {k.totalUnit} unit terdaftar
                    {k.manualHariIni > 0 ? ` (+ ${k.manualHariIni} unit manual)` : ""}.
                </span>
            </form>

            <div className="kal-legenda-baris">
                <span className="kal-legenda"><i className="kal-tanda kal-tanda-garis" /> warna = yang menangani:</span>
                {Object.entries(daftarWarnaReservasi()).map(([kunci, w]) => (
                    <span className="kal-legenda" key={kunci}>
                        <i className="kal-tanda" style={{ background: w.warna }} /> {w.nama}
                    </span>
                ))}
                <span className="kal-legenda"><i className="kal-tanda" /> bebas</span>
            </div>

            {!adaIsi ? (
                <div className="table-kosong">
                    {k.cari !== ""
                        ? `Tidak ada unit yang cocok dengan pencarian "${k.cari}".`
                        : `Belum ada unit yang punya jadwal pada ${k.jumlahHari} hari ke depan. Klik "Tampilkan semua unit" untuk melihat seluruh armada.`}
                </div>
            ) : (
                <>
                    <div className="kal-wrap">
                        <table className="kal-tabel">
                            <thead>
                                <tr>
                                    <th className="kal-unit">Unit / Nopol</th>
                                    {kepalaTanggal}
                                </tr>
                            </thead>
                            <tbody>
                                {k.unitTampil.map((u) => {
                                    const perTanggal = k.jadwal[String(Number(u.id))] ?? {};
                                    return (
                                        <tr key={u.id}>
                                            <td className="kal-unit">
                                                <a href={`/pesanan?cari=${encodeURIComponent(String(u.nopol))}`}>{u.nopol}</a>
                                                <span className="kal-nama">{u.nama_unit}</span>
                                            </td>
                                            {k.tanggal.map((t) => {
                                                const isi = perTanggal[t.tgl] ?? [];
                                                if (isi.length === 0) {
                                                    return <td key={t.tgl}><span className="kal-sel" /></td>;
                                                }
                                                const p0 = isi[0];
                                                const w = warnaPembuat(p0.pembuat);
                                                let teks = `${p0.nomor_order} - ${p0.nama_pesanan} (${statusLabel(p0.status)}) | Ditangani: ${w.nama ?? "-"}`;
                                                if (isi.length > 1) {
                                                    teks += ` +${isi.length - 1} pesanan lain`;
                                                }
                                                return (
                                                    <td key={t.tgl}>
                                                        <a
                                                            className="kal-sel isi"
                                                            href={`/pesanan/${Number(p0.id)}`}
                                                            style={{ background: w.warna, color: w.teks, borderColor: w.warna }}
                                                            title={teks}
                                                        >
                                                            {w.nama}{isi.length > 1 ? "+" : ""}
                                                        </a>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {Object.entries(k.manual).map(([mk, m]) => (
                                    <tr key={mk}>
                                        <td className="kal-unit">
                                            <a href={`/pesanan?cari=${encodeURIComponent(String(mk))}`}>
                                                {m.nopol !== "" ? m.nopol : "-"}
                                            </a>
                                            <span className="kal-nama">
                                                {m.nama_unit}
                                                <span className="kal-tag-manual">manual</span>
                                            </span>
                                        </td>
                                        {k.tanggal.map((t) => {
                                            const isi = m.hari[t.tgl] ?? [];
                                            if (isi.length === 0) {
                                                return <td key={t.tgl}><span className="kal-sel" /></td>;
                                            }
                                            const p0 = isi[0];
                                            const w = warnaPembuat(p0.pembuat);
                                            const teks = `${p0.nomor_order} - ${p0.nama_pesanan} (${statusLabel(p0.status)}) [unit manual] | Ditangani: ${w.nama ?? "-"}`;
                                            return (
                                                <td key={t.tgl}>
                                                    <a
                                                        className="kal-sel isi"
                                                        href={`/pesanan/${Number(p0.id)}`}
                                                        style={{ background: w.warna, color: w.teks, borderColor: w.warna }}
                                                        title={teks}
                                                    >
                                                        {w.nama}
                                                    </a>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ===== Revisi #20: kalender DRIVER ===== */}
                    <h3 className="kal-subjudul">Ketersediaan driver ({k.jumlahHari} hari ke depan)</h3>
                    <div className="form-text mb-2">
                        {k.driverHariIni} driver bertugas hari ini dari {k.totalDriver} driver terdaftar.
                        Kotak berwarna = driver sudah dapat tugas, dan WARNA menunjukkan reservasi yang menangani
                        pesanannya (legenda sama seperti papan unit di atas). Klik kotak untuk membuka pesanannya.
                    </div>
                    {k.driverTampil.length === 0 ? (
                        <div className="table-kosong">
                            Belum ada driver yang punya jadwal pada rentang ini. Klik &quot;Tampilkan semua unit&quot;
                            untuk melihat seluruh driver.
                        </div>
                    ) : (
                        <div className="kal-wrap">
                            <table className="kal-tabel">
                                <thead>
                                    <tr>
                                        <th className="kal-unit">Driver / Perangkat</th>
                                        {kepalaTanggal}
                                    </tr>
                                </thead>
                                <tbody>
                                    {k.driverTampil.map((d) => {
                                        const perTanggal = k.jadwalDriver[String(Number(d.id))] ?? {};
                                        return (
                                            <tr key={d.id}>
                                                <td className="kal-unit">
                                                    <span className="kal-nama-driver">{d.nama}</span>
                                                    <span className="kal-nama">{d.jenjang || "jenjang belum diisi"}</span>
                                                </td>
                                                {k.tanggal.map((t) => {
                                                    const isi = perTanggal[t.tgl] ?? [];
                                                    if (isi.length === 0) {
                                                        return <td key={t.tgl}><span className="kal-sel" /></td>;
                                                    }
                                                    const p0 = isi[0];
                                                    const w = warnaPembuat(p0.pembuat);
                                                    let teks = `${p0.nomor_order} - ${p0.nama_pesanan} (${statusLabel(p0.status)}) | Unit: ${`${p0.nopol ?? ""} ${p0.nama_unit ?? ""}`.trim()} | Ditangani: ${w.nama ?? "-"}`;
                                                    if (isi.length > 1) {
                                                        teks += ` +${isi.length - 1} pesanan lain`;
                                                    }
                                                    return (
                                                        <td key={t.tgl}>
                                                            <a
                                                                className="kal-sel isi"
                                                                href={`/pesanan/${Number(p0.id)}`}
                                                                style={{ background: w.warna, color: w.teks, borderColor: w.warna }}
                                                                title={teks}
                                                            >
                                                                {w.nama}{isi.length > 1 ? "+" : ""}
                                                            </a>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="form-text mt-2">
                        Kotak berwarna = unit terisi, dan WARNA menunjukkan siapa yang menangani pesanannya
                        (lihat legenda di atas). Klik kotak berwarna untuk membuka pesanannya.
                        Huruf di kotak = nama penanggung jawab.
                        {!k.tampilSemua && k.cari === ""
                            ? " Yang ditampilkan hanya unit yang punya jadwal pada rentang ini."
                            : k.tampilSemua
                                ? ` Ditampilkan maksimal ${k.batasBaris} unit pertama (urut nama).`
                                : ""}
                    </div>
                </>
            )}
        </div>
    );
}

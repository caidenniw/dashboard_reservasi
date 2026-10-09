import { rupiah } from "@/lib/format";

/*
 * Satu blok armada/mobil — TIRUAN dari fungsi renderBlokUnit() (sistem lama).
 * PENTING: nama field item_*, kelas .item-unit/.item-head/.unit-no/.pilih-unit/
 * .pilih-driver/.sub-jual/.sub-modal/.btn-hapus-unit dibaca PERSIS oleh app.js &
 * parse_pesanan.js — jangan diganti namanya. .form-sub hanya pengelompokan visual.
 *
 * Komponen ini TIDAK punya state: app.js memutasi DOM-nya (clone/hapus/isi), jadi
 * React tidak boleh ikut mengelola baris ini.
 */
export function BlokArmada({
    it,
    i,
    total,
    units,
    drivers,
    partners,
    bolehModal,
}: {
    it: Record<string, unknown>;
    i: number;
    total: number;
    units: Array<Record<string, unknown>>;
    drivers: Array<Record<string, unknown>>;
    partners: Array<Record<string, unknown>>;
    bolehModal: boolean;
}) {
    const hargaModal = it.harga_modal_per_hari ?? "";
    const hargaJual = it.harga_jual_per_hari ?? "";
    const adaModal = hargaModal !== "" && hargaModal !== null;

    return (
        <div className="item-unit">
            <div className="item-head">
                <span className="unit-no">{`Armada / Mobil ${i + 1}`}</span>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-danger btn-hapus-unit"
                    style={total > 1 ? undefined : { display: "none" }}
                    suppressHydrationWarning
                >
                    Hapus unit
                </button>
            </div>

            <div className="form-grid">
                <div className="form-sub">Driver</div>
                <div>
                    <label className="form-label">Driver <span className="wajib">*</span></label>
                    {/* suppressHydrationWarning: app.js menulis atribut data-prev-* ke
                        elemen ini saat ia dijalankan. Kalau React masih menghidrasi
                        sub-pohon halaman ketika itu terjadi (hidrasi selektif Next),
                        perbedaannya bukan bug — DOM memang milik skrip lama. */}
                    <select className="form-select pilih-driver" name="item_driver_id[]" aria-label="Driver" required defaultValue={String(it.driver_id ?? "")} suppressHydrationWarning>
                        <option value="">-- pilih driver --</option>
                        {drivers.map((dv) => (
                            <option key={String(dv.id)} value={String(dv.id)} data-nama={String(dv.nama ?? "")} data-hp={String(dv.hp ?? "")}>
                                {String(dv.nama ?? "")}{dv.hp ? ` - ${dv.hp}` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">Nama Driver</label>
                    <input type="text" className="form-control" name="item_nama_driver[]" aria-label="Nama driver" defaultValue={String(it.nama_driver ?? "")} />
                    <div className="form-text">Terisi otomatis, bisa dikoreksi.</div>
                </div>
                <div>
                    <label className="form-label">HP Driver</label>
                    <input type="text" className="form-control" name="item_hp_driver[]" aria-label="HP driver" defaultValue={String(it.hp_driver ?? "")} />
                </div>

                <div className="form-sub">Kendaraan</div>
                <div>
                    <label className="form-label">Unit</label>
                    <select className="form-select pilih-unit" name="item_unit_id[]" aria-label="Unit" defaultValue={String(it.unit_id ?? "")} suppressHydrationWarning>
                        <option value="">-- pilih unit --</option>
                        {units.map((un) => (
                            <option
                                key={String(un.id)}
                                value={String(un.id)}
                                data-nama={String(un.nama_unit ?? "")}
                                data-nopol={String(un.nopol ?? "")}
                                data-modal={String(Number(un.harga_modal_default ?? 0))}
                                data-jual={String(Number(un.harga_jual_default ?? 0))}
                            >
                                {String(un.nama_unit ?? "")} - {String(un.nopol ?? "")}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">Nama Unit</label>
                    <input type="text" className="form-control" name="item_nama_unit[]" aria-label="Nama unit" defaultValue={String(it.nama_unit ?? "")} />
                    <div className="form-text">Terisi otomatis, bisa diketik manual.</div>
                </div>
                <div>
                    <label className="form-label">Nomor Polisi</label>
                    <input type="text" className="form-control mono" name="item_nopol[]" aria-label="Nomor polisi" defaultValue={String(it.nopol ?? "")} />
                </div>
                <div>
                    <label className="form-label">Upgrade</label>
                    <input type="text" className="form-control" name="item_upgrade[]" aria-label="Upgrade" list="listUpgrade" defaultValue={String(it.upgrade ?? "")} placeholder="mis: Up Reborn" />
                </div>
                <div>
                    <label className="form-label">Support By</label>
                    <select className="form-select" name="item_partner_id[]" aria-label="Support by" defaultValue={String(it.partner_id ?? "")}>
                        <option value="">-- tidak ada --</option>
                        {partners.map((p) => (
                            <option key={String(p.id)} value={String(p.id)}>{String(p.nama ?? "")}</option>
                        ))}
                    </select>
                </div>

                <div className="form-sub">Harga &amp; Durasi</div>
                {bolehModal ? (
                    <div>
                        <label className="form-label">Harga Modal / Hari <span className="text-soft">(internal)</span></label>
                        <div className="input-group">
                            <span className="input-group-text">Rp</span>
                            <input
                                type="text"
                                className="form-control"
                                name="item_harga_modal[]"
                                aria-label="Harga modal per hari"
                                defaultValue={adaModal ? rupiah(hargaModal as number, false) : ""}
                            />
                        </div>
                        <div className="unit-sub"><span>Subtotal modal</span><span className="sub-modal" suppressHydrationWarning>Rp 0</span></div>
                    </div>
                ) : (
                    /* peran reservasi/finance: kolom modal disembunyikan; nilai tetap dikirim dari master */
                    <input type="hidden" name="item_harga_modal[]" defaultValue={adaModal ? String(Number(hargaModal)) : ""} />
                )}
                <div>
                    <label className="form-label">Harga Jual / Hari</label>
                    <div className="input-group">
                        <span className="input-group-text">Rp</span>
                        <input
                            type="text"
                            className="form-control"
                            name="item_harga_jual[]"
                            aria-label="Harga jual per hari"
                            defaultValue={hargaJual !== "" && hargaJual !== null ? rupiah(hargaJual as number, false) : ""}
                        />
                    </div>
                    <div className="unit-sub"><span>Subtotal jual</span><span className="sub-jual" suppressHydrationWarning>Rp 0</span></div>
                </div>
                <div>
                    <label className="form-label">Hari (per unit)</label>
                    <input type="number" className="form-control" name="item_jumlah_hari[]" aria-label="Jumlah hari per unit" defaultValue={String(it.jumlah_hari ?? "")} />
                </div>
                <div>
                    <label className="form-label">Catatan Unit</label>
                    <input type="text" className="form-control" name="item_catatan[]" aria-label="Catatan unit" defaultValue={String(it.catatan ?? "")} />
                </div>
            </div>
        </div>
    );
}

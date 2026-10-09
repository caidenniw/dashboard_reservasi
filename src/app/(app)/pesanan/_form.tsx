import { notFound } from "next/navigation";
import { harusMasuk } from "@/lib/sesi";
import { roleBoleh, bolehLihatModal } from "@/lib/akses";
import { ambilFlash } from "@/lib/flash-server";
import { statusLabel, rupiah } from "@/lib/format";
import { daftarBank, daftarUpgrade } from "@/lib/app-lib";
import { dataForm } from "@/lib/pesanan-form-server";
import { tokenUntuk } from "@/lib/asisten-server";
import { AlertValidasi } from "@/components/alerts";
import { BlokArmada } from "./blok-armada";
import { SkripMuat, SKRIP_FORM_PESANAN } from "@/components/skrip-muat";
import { TPL_RUTE, TPL_BIAYA, tplUnitHtml } from "./tpl-html";

/*
 * Form Input/Ubah Pesanan — port dari pesanan/form.blade.php.
 *
 * Skrip (app.js untuk baris dinamis + ringkasan; pesanan_form_ext.js untuk picker
 * kota & rute; parse_pesanan.js untuk "Bedah") dimuat sebagai <script> biasa di
 * akhir halaman agar berjalan saat parse, sama seperti Blade.
 */
const STATUS_FORM = ["draft", "inquiry", "quoted", "waiting_dp", "booked", "in_trip", "completed"];

export async function FormPesanan({
    id,
}: {
    id: number;
}) {
    const user = await harusMasuk();
    if (!roleBoleh(user.role, "pesanan.tulis")) {
        return (
            <div className="card-box">
                <div className="card-title">Akses ditolak</div>
                <p className="text-soft mb-0">Peran Anda tidak berhak menulis pesanan.</p>
            </div>
        );
    }

    const data = await dataForm(id);
    if (!data) {
        notFound();
    }

    const flash = await ambilFlash();
    const bolehModal = bolehLihatModal(user.role);
    const banks = await daftarBank();
    const tokenBedah = tokenUntuk(user.id);

    const o = (data.order ?? {}) as Record<string, unknown>;
    const oldArr = flash.old ?? {};
    /* old(field) -> nilai lama; kalau tidak ada pakai data order. */
    const fv = (k: string, d = ""): string => {
        const ov = oldArr[k]?.[0];
        if (ov !== undefined) return ov;
        const v = o[k];
        return v === undefined || v === null ? d : String(v);
    };
    const statusTerkunci = Boolean(data.order) && !STATUS_FORM.includes(String(o.status ?? ""));
    const adaInvoiceAktif = data.adaInvoiceAktif;

    /* Nilai item: kalau ada input lama (validasi gagal), bangun ulang dari array old. */
    const itemsOld = oldArr["item_nopol[]"];
    const items = itemsOld
        ? itemsOld.map((_, i) => ({
            unit_id: oldArr["item_unit_id[]"]?.[i] ?? "",
            nopol: oldArr["item_nopol[]"]?.[i] ?? "",
            upgrade: oldArr["item_upgrade[]"]?.[i] ?? "",
            driver_id: oldArr["item_driver_id[]"]?.[i] ?? "",
            nama_driver: oldArr["item_nama_driver[]"]?.[i] ?? "",
            hp_driver: oldArr["item_hp_driver[]"]?.[i] ?? "",
            harga_modal_per_hari: oldArr["item_harga_modal[]"]?.[i] ?? "",
            harga_jual_per_hari: oldArr["item_harga_jual[]"]?.[i] ?? "",
            jumlah_hari: oldArr["item_jumlah_hari[]"]?.[i] ?? "",
            catatan: oldArr["item_catatan[]"]?.[i] ?? "",
            partner_id: oldArr["item_partner_id[]"]?.[i] ?? "",
        }))
        : data.items;

    const biaya = oldArr["biaya_nama[]"]
        ? oldArr["biaya_nama[]"].map((nama, i) => ({
            nama,
            nominal: oldArr["biaya_nominal[]"]?.[i] ?? "0",
        }))
        : data.biayaOrder;

    const statusFormAwal = fv("status", "booked") || "booked";

    return (
        <>

            <AlertValidasi pesan={flash.error_validasi} />

            {adaInvoiceAktif && (
                <div className="alert alert-warning">
                    Pesanan ini sudah punya <b>invoice yang terbit</b>. Mengubah harga atau jumlah hari di sini
                    <b> tidak mengubah invoice yang sudah terbit</b>. Kalau perlu memperbarui dokumen, simpan dulu,
                    lalu buka halaman detail dan klik <b>Perbarui Invoice</b> (nomor invoice tetap sama).
                </div>
            )}

            <form method="post" action="/pesanan/simpan" id="formPesanan">
                <input type="hidden" name="id" value={Number(o.id ?? 0)} />

                {!data.order && (
                    <div className="card-box" id="kartuBedah" data-parse-url="/api/parse-pesanan" data-parse-token={tokenBedah}>
                        <div className="section-step">
                            <div className="step-no">0</div>
                            <div className="step-title">Isi Cepat dari Teks Pesanan</div>
                        </div>
                        <p className="text-soft mb-2">
                            Tempel teks konfirmasi pesanan (format standar), lalu klik <b>Bedah &amp; Isi Otomatis</b>.
                            Sistem mengisi kolom di bawah secara otomatis; kolom yang terisi disorot kuning untuk diperiksa.
                            Tidak ada yang tersimpan sebelum kamu menekan Simpan.
                        </p>
                        <textarea
                            id="teksPesanan"
                            className="form-control mono"
                            aria-label="Teks pesanan untuk dibedah otomatis"
                            rows={9}
                            spellCheck={false}
                            placeholder={"Pelayanan: Dalam Kota Medan\nTanggal: 03-10-2026 s/d 05-10-2026 (3 Day)\n..."}
                        />
                        <div className="baris-aksi mt-3">
                            <button type="button" className="btn btn-primary btn-sm" id="btnBedah">Bedah &amp; Isi Otomatis</button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" id="btnBedahBersih">Bersihkan</button>
                        </div>
                        <div id="hasilBedah" className="mt-3" />
                    </div>
                )}

                {/* ---------------------------- Langkah 1: Pelayanan ---------------------------- */}
                <div className="card-box">
                    <div className="section-step"><div className="step-no">1</div><div className="step-title">Pelayanan</div></div>
                    <div className="form-grid">
                        <div>
                            <label className="form-label" htmlFor="tipe_pelanggan">Tipe Pelanggan <span className="wajib">*</span></label>
                            <select className="form-select" id="tipe_pelanggan" name="tipe_pelanggan" defaultValue={fv("tipe_pelanggan", "retail")}>
                                <option value="retail">Retail (Perorangan)</option>
                                <option value="corporate">Perusahaan / Instansi</option>
                                <option value="RO">Repeat Order</option>
                                <option value="RTR">RTR (Rent to Rent)</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="wilayah_pelayanan">Wilayah Pelayanan <span className="wajib">*</span></label>
                            <select className="form-select" id="wilayah_pelayanan" name="wilayah_pelayanan" defaultValue={fv("wilayah_pelayanan", "dalam_kota")}>
                                <option value="dalam_kota">Dalam Kota</option>
                                <option value="luar_kota">Luar Kota</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="kotaCari">
                                Kota Pelayanan <span className="wajib">*</span>{" "}
                                <span className="text-soft fw-normal">(kota cabang yang melayani order)</span>
                            </label>
                            <div className="rn-picker" data-picker>
                                <input type="text" className="form-control" id="kotaCari" data-picker-cari defaultValue={fv("kota")} placeholder="ketik nama kota untuk mencari..." autoComplete="off" required />
                                <input type="hidden" name="kota" data-picker-nilai defaultValue={fv("kota")} />
                                <div className="rn-picker-daftar" data-picker-daftar hidden>
                                    {data.kotaPopuler.length > 0 && (
                                        <>
                                            <div className="rn-picker-judul">Sering dipesan</div>
                                            {data.kotaPopuler.map((kp) => (
                                                <button type="button" className="rn-picker-item" data-nilai={kp} key={`p-${kp}`}>{kp}</button>
                                            ))}
                                            <div className="rn-picker-judul">Semua kota ({data.kotaList.length})</div>
                                        </>
                                    )}
                                    {data.kotaList.map((kt) => (
                                        <button type="button" className="rn-picker-item" data-nilai={kt} key={`k-${kt}`}>{kt}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-text">Ketik beberapa huruf (mis. &quot;band&quot;) — daftarnya tersaring otomatis. Kota yang belum ada tetap boleh ditulis dan otomatis masuk Master Kota dengan tanda &quot;baru&quot;.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="tujuan">Tujuan / Rute</label>
                            <input type="text" className="form-control" id="tujuan" name="tujuan" defaultValue={fv("tujuan")} placeholder="contoh: Bandara - Hotel - Kantor" />
                            <div className="form-text">Opsional; dipakai untuk kolom Rute di invoice.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="tgl_mulai">Tanggal Mulai <span className="wajib">*</span></label>
                            <input type="date" className="form-control" id="tgl_mulai" name="tgl_mulai" defaultValue={fv("tgl_mulai")} required />
                            <span className="bantu-tanggal">dd/mm/yyyy</span>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="tgl_finish">Tanggal Selesai <span className="wajib">*</span></label>
                            <input type="date" className="form-control" id="tgl_finish" name="tgl_finish" defaultValue={fv("tgl_finish")} required />
                            <span className="bantu-tanggal">dd/mm/yyyy</span>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="jumlah_hari">Jumlah Hari</label>
                            <input type="number" className="form-control" id="jumlah_hari" name="jumlah_hari" defaultValue={fv("jumlah_hari")} readOnly />
                            <div className="form-text">Dihitung otomatis: tanggal selesai - tanggal mulai + 1 (inklusif).</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="jam">Jam</label>
                            <input type="text" className="form-control" id="jam" name="jam" defaultValue={fv("jam")} placeholder="contoh: 08.00 WIB" />
                            <div className="form-check mt-2">
                                <input className="form-check-input" type="checkbox" id="jam_koordinasi" name="jam_koordinasi" value="1" defaultChecked={Number(fv("jam_koordinasi", "0")) === 1} />
                                <label className="form-check-label" htmlFor="jam_koordinasi">Koordinasi dengan user</label>
                            </div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="standby_point">Standby Point</label>
                            <input type="text" className="form-control" id="standby_point" name="standby_point" defaultValue={fv("standby_point")} placeholder="contoh: Bandara Binaka Gunung Sitoli" />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="flight">Flight</label>
                            <input type="text" className="form-control" id="flight" name="flight" defaultValue={fv("flight")} placeholder="- bila tidak ada" />
                        </div>
                    </div>
                </div>

                {/* ---------------------------- Langkah 2: Customer ---------------------------- */}
                <div className="card-box">
                    <div className="section-step"><div className="step-no">2</div><div className="step-title">Customer &amp; PIC</div></div>
                    <div className="form-grid">
                        <div>
                            <label className="form-label" htmlFor="nama_pesanan">Nama Pesanan / Instansi <span className="wajib">*</span></label>
                            <input type="text" className="form-control" id="nama_pesanan" name="nama_pesanan" list="listCustomer" defaultValue={fv("nama_pesanan")} required />
                            <datalist id="listCustomer">
                                {data.customerList.map((cr, i) => (
                                    <option value={String(cr.nama_pesanan ?? "")} key={i} />
                                ))}
                            </datalist>
                            <div className="form-text">Kalau belum ada di master customer, akan dibuat otomatis saat disimpan.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="sumber">Sumber Order</label>
                            <select className="form-select" id="sumber" name="sumber" defaultValue={fv("sumber", "wa")}>
                                <option value="wa">WhatsApp</option>
                                <option value="telepon">Telepon</option>
                                <option value="instagram">Instagram</option>
                                <option value="tiktok">TikTok</option>
                                <option value="facebook">Facebook</option>
                                <option value="website">Website</option>
                                <option value="referral">Referral</option>
                                <option value="lainnya">Lainnya</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="nama_pic">Nama PIC</label>
                            <input type="text" className="form-control" id="nama_pic" name="nama_pic" defaultValue={fv("nama_pic")} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="hp_pic">HP / WA PIC</label>
                            <input type="text" className="form-control" id="hp_pic" name="hp_pic" defaultValue={fv("hp_pic")} placeholder="08xx / +62xx" />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="data_tamu">Data Tamu <span className="text-soft fw-normal">(internal)</span></label>
                            <input type="text" className="form-control" id="data_tamu" name="data_tamu" defaultValue={fv("data_tamu")} placeholder="mis: Imigrasi / Lapas / Ibu Triana" />
                            <div className="form-text">Pemesan vs tamu: tidak cetak di invoice, hanya internal.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="hp_tamu">No. Telepon Tamu <span className="text-soft fw-normal">(internal)</span></label>
                            <input type="tel" className="form-control" id="hp_tamu" name="hp_tamu" defaultValue={fv("hp_tamu")} placeholder="08xx / +62xx" />
                            <div className="form-text">Revisi presentasi #1: kolom Keterangan diganti nomor telepon tamu. Tidak dicetak di invoice.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="asal_user_raw">Asal User (arsip Excel)</label>
                            <input type="text" className="form-control" id="asal_user_raw" name="asal_user_raw" list="listAsalUser" defaultValue={fv("asal_user_raw")} placeholder="kosongkan jika input baru" />
                            <datalist id="listAsalUser">
                                <option value="RTR" /><option value="Corp" /><option value="RO" /><option value="Apkasi" />
                                <option value="IG" /><option value="Web" /><option value="Bu Tika" />
                            </datalist>
                            <div className="form-text">Isi kalau mau samakan sheet lama. Jika diisi, Tipe Pelanggan &amp; Sumber otomatis mengikuti. RTR = Rent to Rent (biro lain sewa unit kita).</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="handle_by">Handle By</label>
                            <input type="text" className="form-control" id="handle_by" name="handle_by" defaultValue={fv("handle_by", user.nama)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="template_invoice">Template Invoice</label>
                            <select className="form-select" id="template_invoice" name="template_invoice" defaultValue={String(o.template_invoice ?? "klasik")}>
                                <option value="klasik">Klasik (bawaan sistem)</option>
                                <option value="modern">Modern 1000 (desain baru)</option>
                            </select>
                            <div className="form-text">Revisi #3: tiap pesanan boleh punya template invoice sendiri.</div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="bank_invoice">Opsi Bank di Invoice</label>
                            <select className="form-select" id="bank_invoice" name="bank_invoice" defaultValue={String(o.bank_invoice ?? "")}>
                                <option value="">Semua bank (bawaan)</option>
                                {banks.map((b) => (
                                    <option value={b.nama} key={b.nama}>{b.nama}</option>
                                ))}
                            </select>
                            <div className="form-text">Revisi #5: kalau dipilih, hanya bank itu yang dicetak di invoice.</div>
                        </div>
                        <div className="full">
                            <label className="form-label" htmlFor="catatan">Catatan Internal</label>
                            <textarea className="form-control" id="catatan" name="catatan" rows={2} defaultValue={fv("catatan")} />
                        </div>
                    </div>
                </div>

                {/* ---------------------------- Langkah 3: Unit & Harga ---------------------------- */}
                <div className="card-box">
                    <div className="section-step"><div className="step-no">3</div><div className="step-title">Unit, Driver &amp; Harga</div></div>

                    <div id="wadahUnit">
                        {items.map((it, idx) => (
                            <BlokArmada
                                key={idx}
                                it={it as Record<string, unknown>}
                                i={idx}
                                total={items.length}
                                units={data.units}
                                drivers={data.drivers}
                                partners={data.partners}
                                bolehModal={bolehModal}
                            />
                        ))}
                    </div>
                    <div className="tambah-baris mt-3">
                        <button type="button" className="btn btn-sm btn-outline-secondary" id="btnTambahUnit">+ Tambah Mobil Lain (Rombongan)</button>
                        <span className="form-text">Gunakan jika pesanan menyewa lebih dari satu kendaraan dalam satu tagihan/faktur.</span>
                    </div>

                    <hr className="my-4" />

                    <div className="form-label">Rute Perjalanan <span className="text-soft fw-normal">(opsional — bisa ditambah kapan saja)</span></div>
                    <div id="wadahRute">
                        {data.ruteList.map((rt, i) => (
                            <div className="row g-2 mb-2 baris-rute" key={i}>
                                <div className="col-md-3"><input type="text" className="form-control form-control-sm" name="rute_dari[]" aria-label="Rute dari" defaultValue={String(rt.dari ?? "")} placeholder="dari (kota)" /></div>
                                <div className="col-md-3"><input type="text" className="form-control form-control-sm" name="rute_ke[]" aria-label="Rute ke" defaultValue={String(rt.ke ?? "")} placeholder="ke (kota)" /></div>
                                <div className="col-md-2"><input type="date" className="form-control form-control-sm" name="rute_tgl[]" aria-label="Tanggal rute" defaultValue={String(rt.tgl ?? "")} /><span className="bantu-tanggal">dd/mm/yyyy</span></div>
                                <div className="col-md-2"><input type="text" className="form-control form-control-sm" name="rute_jam[]" aria-label="Jam rute" defaultValue={String(rt.jam ?? "")} placeholder="jam (opsional)" /></div>
                                <div className="col-md-2 flex gap-1">
                                    <input type="text" className="form-control form-control-sm" name="rute_catatan[]" aria-label="Catatan rute" defaultValue={String(rt.catatan ?? "")} placeholder="catatan" />
                                    <button type="button" className="btn btn-sm btn-outline-danger btn-hapus-rute" aria-label="Hapus rute">x</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="tambah-baris mt-1">
                        <button type="button" className="btn btn-sm btn-outline-secondary" id="btnTambahRute">+ Tambah Rute</button>
                        <span className="form-text">Contoh: customer minta tambah rute &quot;Binjai → Parapat&quot; sebelum pesanannya difinalkan.</span>
                    </div>

                    <hr className="my-4" />

                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-label">Biaya Tambahan</div>
                            <div id="wadahBiaya">
                                {biaya.map((b, i) => (
                                    <div className="flex gap-2 mb-2 baris-biaya" key={i}>
                                        <input type="text" className="form-control form-control-sm" name="biaya_nama[]" aria-label="Nama biaya" defaultValue={String(b.nama ?? "")} placeholder="nama biaya" />
                                        <input type="text" className="form-control form-control-sm" name="biaya_nominal[]" aria-label="Nominal biaya" defaultValue={b.nominal !== undefined && b.nominal !== null && b.nominal !== "" ? rupiah(b.nominal as number, false) : ""} placeholder="nominal" />
                                        <button type="button" className="btn btn-sm btn-outline-danger btn-hapus-biaya" aria-label="Hapus biaya">x</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-secondary mt-1" id="btnTambahBiaya">+ Tambah biaya</button>
                        </div>
                        <div className="col-md-6">
                            <div className="form-label">Include</div>
                            {data.includes.map((inc) => {
                                const iid = Number(inc.id);
                                const terpilih = data.includeTerpilih[iid];
                                const centang = terpilih !== undefined || (!data.order && Number(inc.is_default) === 1);
                                return (
                                    <div className="flex items-center gap-2 mb-2" key={iid}>
                                        <div className="form-check mb-0 flex-grow-1">
                                            <input className="form-check-input" type="checkbox" id={`inc_${iid}`} name="include_id[]" value={iid} defaultChecked={centang} />
                                            <label className="form-check-label" htmlFor={`inc_${iid}`}>{String(inc.nama ?? "")}</label>
                                        </div>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm form-control-opsi"
                                            name={`include_biaya[${iid}]`}
                                            aria-label={`Biaya ${String(inc.nama ?? "")}`}
                                            defaultValue={terpilih !== undefined && terpilih > 0 ? rupiah(terpilih, false) : ""}
                                            placeholder="biaya (opsional)"
                                        />
                                    </div>
                                );
                            })}
                            <div className="form-text">Biaya include diisi hanya kalau dibebankan sebagai tambahan.</div>
                        </div>
                    </div>

                    <div className="ringkas mt-4">
                        <div className="row g-2 items-end mb-2">
                            <div className="col-md-5">
                                <label className="form-label" htmlFor="panjar">Panjar / DP Awal (opsional)</label>
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text">Rp</span>
                                    <input type="text" className="form-control" id="panjar" name="panjar" defaultValue={Number(fv("panjar", "0")) > 0 ? rupiah(fv("panjar"), false) : ""} placeholder="0" />
                                </div>
                                <div className="form-text">Kalau customer sudah transfer sebelum invoice terbit. Nanti otomatis jadi pembayaran DP di invoice — tidak perlu input dua kali. Kosongkan jika belum ada.</div>
                            </div>
                            <div className="col-md-7 text-right">
                                <div className="form-text">Sisa setelah panjar: <b className="mono" id="rkSisa" suppressHydrationWarning>Rp 0</b></div>
                            </div>
                        </div>
                        {/* Semua angka ringkasan di bawah ini diisi app.js (tulis()).
                            suppressHydrationWarning menjaga hidrasi tetap tenang kalau
                            skrip itu menulis lebih dulu daripada hidrasi sub-pohon. */}
                        {bolehModal && (
                            <div className="ringkas-row"><span>Subtotal modal (internal)</span><span className="mono" id="rkModal" suppressHydrationWarning>Rp 0</span></div>
                        )}
                        <div className="ringkas-row"><span>Subtotal jual</span><span className="mono" id="rkJual" suppressHydrationWarning>Rp 0</span></div>
                        <div className="ringkas-row"><span>Biaya tambahan</span><span className="mono" id="rkTambahan" suppressHydrationWarning>Rp 0</span></div>
                        <div className="ringkas-row total"><span>Total Tagihan Customer</span><span className="mono" id="rkTotal" suppressHydrationWarning>Rp 0</span></div>
                        <div className="ringkas-row"><span>Panjar</span><span className="mono" id="rkPanjar" suppressHydrationWarning>Rp 0</span></div>
                        <div className="ringkas-row total"><span>Sisa Tagihan</span><span className="mono" id="rkSisa2" suppressHydrationWarning>Rp 0</span></div>
                        <div className="ringkas-row margin"><span>Margin (internal)</span><span className="mono" id="rkMargin" suppressHydrationWarning>Rp 0</span></div>
                    </div>
                    <datalist id="listUpgrade">
                        {daftarUpgrade().map((up) => (
                            <option value={up} key={up} />
                        ))}
                    </datalist>
                </div>

                {/* ---------------------------- Status & simpan ---------------------------- */}
                <div className="card-box">
                    <div className="flex flex-wrap gap-3 items-end justify-between">
                        <div className="form-min">
                            <label className="form-label" htmlFor="status">Status Pesanan</label>
                            {statusTerkunci ? (
                                <>
                                    <div className="form-control form-terkunci mono">{statusLabel(String(o.status))}</div>
                                    <input type="hidden" name="status" value={String(o.status)} />
                                    <div className="form-text">
                                        Status ini mengikuti dokumen invoice/pembayaran, jadi tidak diubah dari sini.
                                        Perubahannya lewat tombol <b>Perbarui Invoice</b> atau <b>Batalkan Pesanan</b> di halaman detail.
                                    </div>
                                </>
                            ) : (
                                <select className="form-select" id="status" name="status" defaultValue={statusFormAwal}>
                                    {STATUS_FORM.map((s) => (
                                        <option value={s} key={s}>{statusLabel(s)}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="baris-aksi">
                            <button type="submit" name="aksi" value="simpan" className="btn btn-primary btn-sm">
                                {data.order ? "Simpan Perubahan" : "Simpan Pesanan"}
                            </button>
                            <button type="submit" name="aksi" value="draft" className="btn btn-outline-secondary btn-sm" formNoValidate>
                                Simpan Draft
                            </button>
                            <a className="btn btn-outline-secondary btn-sm" href="/pesanan">Batal</a>
                        </div>
                    </div>
                </div>
            </form>

            {/* Template baris — di-clone oleh app.js & pesanan_form_ext.js.
                Isi template ditulis sebagai HTML mentah: React tidak bisa menghidrasi
                isi <template> (browser memindahkannya ke DocumentFragment), jadi
                membiarkannya sebagai JSX memicu hydration mismatch. */}
            <template id="tplRute" dangerouslySetInnerHTML={{ __html: TPL_RUTE }} />
            <template
                id="tplUnit"
                dangerouslySetInnerHTML={{
                    __html: tplUnitHtml(data.units, data.drivers, data.partners, bolehModal),
                }}
            />
            <template id="tplBiaya" dangerouslySetInnerHTML={{ __html: TPL_BIAYA }} />

            <SkripMuat daftar={SKRIP_FORM_PESANAN} />
        </>
    );
}

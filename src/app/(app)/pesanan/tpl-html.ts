/*
 * Isi <template> untuk baris rute & biaya — SALINAN dari resources/views/pesanan/form.blade.php.
 * Ditulis sebagai string HTML karena React tidak bisa menghidrasi isi <template>
 * (browser memindahkannya ke DocumentFragment → hydration mismatch).
 * Nama field & kelas harus sama: dibaca app.js / pesanan_form_ext.js.
 */

export const TPL_RUTE = `
<div class="row g-2 mb-2 baris-rute">
    <div class="col-md-3"><input type="text" class="form-control form-control-sm" name="rute_dari[]" aria-label="Rute dari" placeholder="dari (kota)"></div>
    <div class="col-md-3"><input type="text" class="form-control form-control-sm" name="rute_ke[]" aria-label="Rute ke" placeholder="ke (kota)"></div>
    <div class="col-md-2"><input type="date" class="form-control form-control-sm" name="rute_tgl[]" aria-label="Tanggal rute"><span class="bantu-tanggal">dd/mm/yyyy</span></div>
    <div class="col-md-2"><input type="text" class="form-control form-control-sm" name="rute_jam[]" aria-label="Jam rute" placeholder="jam (opsional)"></div>
    <div class="col-md-2 d-flex gap-1">
        <input type="text" class="form-control form-control-sm" name="rute_catatan[]" aria-label="Catatan rute" placeholder="catatan">
        <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-rute" aria-label="Hapus rute">x</button>
    </div>
</div>`;

export const TPL_BIAYA = `
<div class="d-flex gap-2 mb-2 baris-biaya">
    <input type="text" class="form-control form-control-sm" name="biaya_nama[]" aria-label="Nama biaya" placeholder="nama biaya">
    <input type="text" class="form-control form-control-sm" name="biaya_nominal[]" aria-label="Nominal biaya" placeholder="nominal">
    <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-biaya" aria-label="Hapus biaya">x</button>
</div>`;

/** Escape nilai agar aman dimasukkan ke atribut/teks HTML. */
function esc(v: unknown): string {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Isi <template id="tplUnit"> — cerminan markup BlokArmada dengan i=0 & total=1,
 * sama seperti `@include('pesanan._blok_armada', ['it' => [], 'i' => 0, 'total' => 1])`
 * di Blade. app.js men-clone-nya lalu membereskan nomor urut & menyembunyikan
 * tombol hapus bila hanya ada satu unit.
 */
export function tplUnitHtml(
    units: Array<Record<string, unknown>>,
    drivers: Array<Record<string, unknown>>,
    partners: Array<Record<string, unknown>>,
    bolehModal: boolean,
): string {
    const opsiUnit = units
        .map(
            (un) =>
                `<option value="${esc(un.id)}" data-nama="${esc(un.nama_unit)}" data-nopol="${esc(un.nopol)}" data-modal="${esc(Number(un.harga_modal_default ?? 0))}" data-jual="${esc(Number(un.harga_jual_default ?? 0))}">${esc(un.nama_unit)} - ${esc(un.nopol)}</option>`,
        )
        .join("");
    const opsiDriver = drivers
        .map(
            (dv) =>
                `<option value="${esc(dv.id)}" data-nama="${esc(dv.nama)}" data-hp="${esc(dv.hp ?? "")}">${esc(dv.nama)}${dv.hp ? " - " + esc(dv.hp) : ""}</option>`,
        )
        .join("");
    const opsiPartner = partners
        .map((p) => `<option value="${esc(p.id)}">${esc(p.nama)}</option>`)
        .join("");

    const blokModal = bolehModal
        ? `<div>
                <label class="form-label">Harga Modal / Hari <span class="text-soft">(internal)</span></label>
                <div class="input-group">
                    <span class="input-group-text">Rp</span>
                    <input type="text" class="form-control" name="item_harga_modal[]" aria-label="Harga modal per hari" value="">
                </div>
                <div class="unit-sub"><span>Subtotal modal</span><span class="sub-modal">Rp 0</span></div>
            </div>`
        : `<input type="hidden" name="item_harga_modal[]" value="">`;

    return `
<div class="item-unit">
    <div class="item-head">
        <span class="unit-no">Armada / Mobil 1</span>
        <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-unit" style="display:none;">Hapus unit</button>
    </div>
    <div class="form-grid">
        <div class="form-sub">Driver</div>
        <div>
            <label class="form-label">Driver <span class="wajib">*</span></label>
            <select class="form-select pilih-driver" name="item_driver_id[]" aria-label="Driver" required>
                <option value="">-- pilih driver --</option>${opsiDriver}
            </select>
        </div>
        <div>
            <label class="form-label">Nama Driver</label>
            <input type="text" class="form-control" name="item_nama_driver[]" aria-label="Nama driver" value="">
            <div class="form-text">Terisi otomatis, bisa dikoreksi.</div>
        </div>
        <div>
            <label class="form-label">HP Driver</label>
            <input type="text" class="form-control" name="item_hp_driver[]" aria-label="HP driver" value="">
        </div>
        <div class="form-sub">Kendaraan</div>
        <div>
            <label class="form-label">Unit</label>
            <select class="form-select pilih-unit" name="item_unit_id[]" aria-label="Unit">
                <option value="">-- pilih unit --</option>${opsiUnit}
            </select>
        </div>
        <div>
            <label class="form-label">Nama Unit</label>
            <input type="text" class="form-control" name="item_nama_unit[]" aria-label="Nama unit" value="">
            <div class="form-text">Terisi otomatis, bisa diketik manual.</div>
        </div>
        <div>
            <label class="form-label">Nomor Polisi</label>
            <input type="text" class="form-control mono" name="item_nopol[]" aria-label="Nomor polisi" value="">
        </div>
        <div>
            <label class="form-label">Upgrade</label>
            <input type="text" class="form-control" name="item_upgrade[]" aria-label="Upgrade" list="listUpgrade" value="" placeholder="mis: Up Reborn">
        </div>
        <div>
            <label class="form-label">Support By</label>
            <select class="form-select" name="item_partner_id[]" aria-label="Support by">
                <option value="">-- tidak ada --</option>${opsiPartner}
            </select>
        </div>
        <div class="form-sub">Harga &amp; Durasi</div>
        ${blokModal}
        <div>
            <label class="form-label">Harga Jual / Hari</label>
            <div class="input-group">
                <span class="input-group-text">Rp</span>
                <input type="text" class="form-control" name="item_harga_jual[]" aria-label="Harga jual per hari" value="">
            </div>
            <div class="unit-sub"><span>Subtotal jual</span><span class="sub-jual">Rp 0</span></div>
        </div>
        <div>
            <label class="form-label">Hari (per unit)</label>
            <input type="number" class="form-control" name="item_jumlah_hari[]" aria-label="Jumlah hari per unit" value="">
        </div>
        <div>
            <label class="form-label">Catatan Unit</label>
            <input type="text" class="form-control" name="item_catatan[]" aria-label="Catatan unit" value="">
        </div>
    </div>
</div>`;
}

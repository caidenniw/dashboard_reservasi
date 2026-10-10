import "server-only";
import { query, queryOne, execute, transaction } from "@/lib/db";
import { hitungHari, angka, normalisasiHp, rupiah, tglAngka } from "@/lib/format";
import { nomorDokumen, hitungOrder, catatStatus, cekBentrokUnit, mapAsalUser } from "@/lib/app-lib";
import { bolehLihatModal, type Role } from "@/lib/akses";
import type { SesiUser } from "@/lib/auth";

/*
 * Form Input/Ubah Pesanan — PORT dari PesananFormController (form + simpan).
 * Semua aturan bisnis disalin apa adanya.
 */

const STATUS_FORM_SAFE = ["draft", "inquiry", "quoted", "waiting_dp", "booked", "in_trip", "completed"];

/* ================================ FORM ================================ */

export interface DataForm {
    order: Record<string, unknown> | null;
    units: Array<Record<string, unknown>>;
    drivers: Array<Record<string, unknown>>;
    partners: Array<Record<string, unknown>>;
    includes: Array<Record<string, unknown>>;
    kotaList: string[];
    kotaPopuler: string[];
    ruteList: Array<Record<string, unknown>>;
    customerList: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
    includeTerpilih: Record<number, number>;
    biayaOrder: Array<Record<string, unknown>>;
    adaInvoiceAktif: boolean;
}

export async function dataForm(id: number): Promise<DataForm | null> {
    const order = id > 0 ? await ambilOrderLengkap(id) : null;
    if (id > 0 && !order) {
        return null;
    }

    const units = await query<Record<string, unknown>>(
        "SELECT * FROM units WHERE deleted_at IS NULL AND status <> 'nonaktif' ORDER BY nama_unit",
    );
    const drivers = await query<Record<string, unknown>>(
        "SELECT * FROM drivers WHERE deleted_at IS NULL AND status = 'aktif' ORDER BY nama",
    );
    const partners = await query<Record<string, unknown>>(
        "SELECT * FROM partners WHERE deleted_at IS NULL ORDER BY nama",
    );
    const includes = await query<Record<string, unknown>>(
        "SELECT * FROM includes ORDER BY urutan, nama",
    );

    /* KOTA dari MASTER: "sering dipesan" dari riwayat, lalu kota master, lalu kota lama. */
    const kotaPopuler = (
        await query<{ kota: string }>(
            `SELECT kota, COUNT(*) j FROM orders
             WHERE deleted_at IS NULL AND status NOT IN ('cancelled','closed')
               AND kota IS NOT NULL AND kota <> ''
             GROUP BY kota ORDER BY j DESC LIMIT 8`,
        )
    ).map((r) => r.kota);
    const kotaMaster = (await query<{ nama: string }>("SELECT nama FROM kota WHERE deleted_at IS NULL ORDER BY nama")).map((r) => r.nama);
    const kotaLama = (
        await query<{ kota: string }>(
            "SELECT DISTINCT kota FROM orders WHERE deleted_at IS NULL AND kota IS NOT NULL AND kota <> ''",
        )
    ).map((r) => r.kota);
    const kotaList = Array.from(new Set([...kotaPopuler, ...kotaMaster, ...kotaLama]));

    const ruteList = order
        ? await query<Record<string, unknown>>(
            "SELECT * FROM order_rute WHERE order_id = ? ORDER BY urutan",
            [id],
        )
        : [];
    const customerList = await query<Record<string, unknown>>(
        "SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY nama_pesanan LIMIT 500",
    );

    let items = (order?.items as Array<Record<string, unknown>>) ?? [];
    if (items.length === 0) {
        items = [{
            unit_id: "", nopol: "", upgrade: "", driver_id: "", nama_driver: "",
            harga_modal_per_hari: "", harga_jual_per_hari: "", jumlah_hari: "",
            catatan: "", partner_id: "",
        }];
    }

    const includeTerpilih: Record<number, number> = {};
    for (const inc of (order?.includes as Array<Record<string, unknown>>) ?? []) {
        if (inc.include_id) {
            includeTerpilih[Number(inc.include_id)] = Number(inc.biaya);
        }
    }
    const biayaOrder = (order?.biaya as Array<Record<string, unknown>>) ?? [];

    let adaInvoiceAktif = false;
    for (const iv of (order?.invoices as Array<Record<string, unknown>>) ?? []) {
        if (iv.status !== "batal") {
            adaInvoiceAktif = true;
            break;
        }
    }

    return {
        order, units, drivers, partners, includes, kotaList, kotaPopuler, ruteList,
        customerList, items, includeTerpilih, biayaOrder, adaInvoiceAktif,
    };
}

/** ambilOrder + items/includes/biaya/invoices/logs (dari app_lib). */
async function ambilOrderLengkap(id: number): Promise<Record<string, unknown> | null> {
    const { ambilOrder } = await import("@/lib/app-lib");
    return ambilOrder(id) as Promise<Record<string, unknown> | null>;
}

/* =============================== SIMPAN =============================== */

export interface HasilSimpanPesanan {
    errors: string[];
    orderId?: number;
    pesan?: string;
}

export async function simpanPesanan(form: FormData, user: SesiUser): Promise<HasilSimpanPesanan> {
    const role: Role = user.role;
    const id = Number(form.get("id") ?? 0) || 0;
    const aksi = String(form.get("aksi") ?? "simpan");

    const s = (k: string) => String(form.get(k) ?? "");
    const arr = (k: string) => form.getAll(k).map((v) => String(v));

    const nama_pesanan = s("nama_pesanan").trim();
    const kota = s("kota").trim();
    const data_tamu = s("data_tamu").trim();
    const keterangan = s("keterangan").trim();
    const hpTamu = s("hp_tamu").trim();
    const templateInv = s("template_invoice").trim() || "klasik";
    const bankInv = s("bank_invoice").trim();
    const asal_user_raw = s("asal_user_raw").trim();
    const panjar = angka(s("panjar"));
    const tgl_mulai = s("tgl_mulai").trim();
    const tgl_finish = s("tgl_finish").trim();
    const jumlah_hari = hitungHari(tgl_mulai, tgl_finish);

    let status = s("status") || "booked";
    if (aksi === "draft") {
        status = "draft";
    } else if (!STATUS_FORM_SAFE.includes(status)) {
        status = "booked";
    }

    const errors: string[] = [];
    if (nama_pesanan === "") {
        errors.push("Nama pesanan/instansi wajib diisi.");
    }
    if (kota === "") {
        errors.push("Kota/lokasi wajib diisi.");
    }
    if (!tgl_mulai || !tgl_finish) {
        errors.push("Tanggal mulai dan tanggal selesai wajib diisi.");
    }
    if (tgl_mulai && tgl_finish && jumlah_hari < 1) {
        errors.push("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
    }

    /* ---------------------------- item unit ---------------------------- */
    const arrUnitId = arr("item_unit_id[]");
    const arrNopol = arr("item_nopol[]");
    const arrNama = arr("item_nama_unit[]");
    const arrDriverId = arr("item_driver_id[]");
    const arrNamaDrv = arr("item_nama_driver[]");
    const arrHpDrv = arr("item_hp_driver[]");
    const arrModal = arr("item_harga_modal[]");
    const arrJual = arr("item_harga_jual[]");
    const arrHari = arr("item_jumlah_hari[]");
    const arrCatatan = arr("item_catatan[]");
    const arrPartnerId = arr("item_partner_id[]");
    const arrUpgrade = arr("item_upgrade[]");

    interface BarisItem {
        unit_id: number; driver_id: number | null; partner_id: number | null; upgrade: string;
        nama_unit: string; nopol: string; nama_driver: string; hp_driver: string;
        harga_modal: number; harga_jual: number; jumlah_hari: number;
        subtotal_modal: number; subtotal_jual: number; catatan: string;
    }
    const items: BarisItem[] = [];

    for (let i = 0; i < arrNopol.length; i++) {
        const unitId = Number(arrUnitId[i] ?? 0) || 0;
        let nopol = (arrNopol[i] ?? "").trim().toUpperCase();
        let nama = (arrNama[i] ?? "").trim();
        const drvId = Number(arrDriverId[i] ?? 0) || 0;
        let namaDrv = (arrNamaDrv[i] ?? "").trim();
        let hpDrv = (arrHpDrv[i] ?? "").trim();

        if (unitId > 0) {
            const u = await queryOne<{ nama_unit: string; nopol: string }>(
                "SELECT nama_unit, nopol FROM units WHERE id = ? LIMIT 1", [unitId],
            );
            if (u) {
                if (nama === "") nama = u.nama_unit;
                if (nopol === "") nopol = u.nopol.toUpperCase();
            }
        }
        if (drvId > 0) {
            const d = await queryOne<{ nama: string; hp: string | null }>(
                "SELECT nama, hp FROM drivers WHERE id = ? LIMIT 1", [drvId],
            );
            if (d) {
                if (namaDrv === "") namaDrv = d.nama;
                if (hpDrv === "") hpDrv = normalisasiHp(d.hp ?? "");
            }
        }
        if (hpDrv !== "") hpDrv = normalisasiHp(hpDrv);

        if (nama === "" && nopol === "" && unitId === 0) {
            continue;
        }
        if (nama === "" || nopol === "") {
            errors.push(`Baris unit ${i + 1}: nama unit dan nomor polisi wajib lengkap.`);
            continue;
        }

        let hari = Number(arrHari[i] ?? 0) || 0;
        if (hari <= 0) {
            hari = Math.max(1, jumlah_hari);
        }
        let modal = angka(arrModal[i] ?? 0);
        const jual = angka(arrJual[i] ?? 0);

        if (drvId === 0 && namaDrv === "") {
            errors.push(`Baris unit ${i + 1}: driver wajib dipilih.`);
        }

        const partnerItem = Number(arrPartnerId[i] ?? 0) || 0;

        /* PERAN TANPA HAK LIHAT MODAL: nilai modal dari form DIABAIKAN, dipakai
           harga modal default dari master unit supaya angka tetap benar. */
        if (!bolehLihatModal(role)) {
            modal = await hargaModalMaster(unitId);
        }

        items.push({
            unit_id: unitId,
            driver_id: drvId ? drvId : null,
            partner_id: partnerItem > 0 ? partnerItem : null,
            upgrade: (arrUpgrade[i] ?? "").trim(),
            nama_unit: nama,
            nopol,
            nama_driver: namaDrv,
            hp_driver: hpDrv,
            harga_modal: modal,
            harga_jual: jual,
            jumlah_hari: hari,
            subtotal_modal: modal * hari,
            subtotal_jual: jual * hari,
            catatan: (arrCatatan[i] ?? "").trim(),
        });
    }
    if (items.length === 0) {
        errors.push("Minimal satu unit harus diisi (nama unit + nomor polisi).");
    }

    /* ---- panjar tidak boleh melebihi total tagihan ---- */
    let totalJualTmp = 0;
    for (const it of items) {
        totalJualTmp += it.subtotal_jual;
    }
    let incTmp = 0;
    for (const iid of form.getAll("include_id[]")) {
        incTmp += angka(form.get(`include_biaya[${Number(iid)}]`) ?? 0);
    }
    let biayaTmp = 0;
    for (const nom of form.getAll("biaya_nominal[]")) {
        biayaTmp += angka(nom);
    }
    const grandTmp = totalJualTmp + incTmp + biayaTmp;
    if (panjar > 0 && grandTmp > 0 && panjar > grandTmp) {
        errors.push(
            `Panjar ${rupiah(panjar)} melebihi total tagihan ${rupiah(grandTmp)}. Periksa nominal panjar atau harga/hari unitnya.`,
        );
    }

    /* ---- bentrok jadwal unit ---- */
    if (items.length > 0 && status !== "draft" && tgl_mulai && tgl_finish) {
        for (const it of items) {
            if (!it.unit_id) {
                continue;
            }
            for (const b of await cekBentrokUnit(it.unit_id, tgl_mulai, tgl_finish, id)) {
                errors.push(
                    `Unit ${it.nopol} sudah dipakai pada ${b.nomor_order} (${tglAngka(b.tgl_mulai)} s/d ${tglAngka(b.tgl_finish)} - ${b.nama_pesanan}).`,
                );
            }
        }
    }

    if (errors.length > 0) {
        return { errors };
    }

    /* ------------------- customer: cari atau buat ------------------- */
    const namaPic = s("nama_pic").trim();
    const hpPic = normalisasiHp(s("hp_pic"));
    let sumber = s("sumber") || "wa";
    let tipePelanggan = s("tipe_pelanggan") || "retail";
    const wilayah = s("wilayah_pelayanan") || "dalam_kota";

    if (asal_user_raw !== "") {
        const mapTmp = mapAsalUser(asal_user_raw);
        tipePelanggan = mapTmp.tipe;
        sumber = mapTmp.sumber;
    }

    const cust = await queryOne<{ id: number }>(
        "SELECT id FROM customers WHERE deleted_at IS NULL AND LOWER(nama_pesanan) = LOWER(?) LIMIT 1",
        [nama_pesanan],
    );
    let customerId: number;
    if (cust) {
        customerId = Number(cust.id);
    } else {
        const tipeCust = /\b(PT|CV|UD|Dinas|Kantor|Badan|Otoritas|Bank|Universitas|Sekolah|Prov|Kab)\b/i.test(nama_pesanan)
            ? "instansi"
            : "perorangan";
        const res = await execute(
            "INSERT INTO customers (tipe, nama_pesanan, nama_pic, hp_pic, sumber, status) VALUES (?, ?, ?, ?, ?, 'baru')",
            [tipeCust, nama_pesanan, namaPic, hpPic, sumber],
        );
        customerId = res.insertId;
    }

    /* ------------------------- simpan order ------------------------- */
    const jam = s("jam").trim();
    const jamKoordinasi = form.has("jam_koordinasi") ? 1 : 0;
    const standby = s("standby_point").trim();
    const flight = s("flight").trim();
    const tujuan = s("tujuan").trim();
    const handleBy = s("handle_by").trim() || user.nama;
    const catatanOrder = s("catatan").trim();
    let statusLama: string | null = null;

    const data: Record<string, string | number | null> = {
        customer_id: customerId,
        tipe_pelanggan: tipePelanggan,
        wilayah_pelayanan: wilayah,
        kota,
        tgl_mulai,
        tgl_finish,
        jumlah_hari,
        jam: jam !== "" ? jam : null,
        jam_koordinasi: jamKoordinasi,
        standby_point: standby !== "" ? standby : null,
        flight: flight !== "" ? flight : null,
        tujuan: tujuan !== "" ? tujuan : null,
        nama_pesanan,
        nama_pic: namaPic !== "" ? namaPic : null,
        hp_pic: hpPic !== "" ? hpPic : null,
        data_tamu: data_tamu !== "" ? data_tamu : null,
        sumber,
        asal_user_raw: asal_user_raw !== "" ? asal_user_raw : null,
        handle_by: handleBy,
        partner_id: null, // Support By kini per unit (order_items.partner_id)
        panjar,
        keterangan: keterangan !== "" ? keterangan : null,
        hp_tamu: hpTamu !== "" ? hpTamu : null,
        template_invoice: templateInv,
        bank_invoice: bankInv !== "" ? bankInv : null,
        status,
        catatan: catatanOrder !== "" ? catatanOrder : null,
    };

    /* Kota yang belum ada di master -> otomatis masuk dengan tanda 'baru'. */
    if (kota !== "") {
        const adaKota = await queryOne<{ id: number }>(
            "SELECT id FROM kota WHERE LOWER(nama) = LOWER(?) LIMIT 1", [kota],
        );
        if (!adaKota) {
            await execute("INSERT INTO kota (nama, wilayah_id, baru, urutan) VALUES (?, NULL, 1, 0)", [kota]);
        }
    }

    let orderId: number;
    try {
        orderId = await transaction(async (conn) => {
            let oid: number;
            if (id > 0) {
                const [rowLama] = await conn.query("SELECT status FROM orders WHERE id = ? LIMIT 1", [id]);
                statusLama = (rowLama as Array<{ status: string }>)[0]?.status ?? null;

                /* Kunci status tingkat dokumen: jangan pernah diturunkan oleh simpan form. */
                if (statusLama !== null && !STATUS_FORM_SAFE.includes(statusLama)) {
                    status = statusLama;
                    data.status = status;
                }

                const kolom = Object.keys(data);
                await conn.query(
                    `UPDATE orders SET ${kolom.map((k) => `\`${k}\` = ?`).join(", ")} WHERE id = ?`,
                    [...kolom.map((k) => data[k]), id],
                );
                await conn.query("DELETE FROM order_items WHERE order_id = ?", [id]);
                await conn.query("DELETE FROM order_includes WHERE order_id = ?", [id]);
                await conn.query("DELETE FROM order_biaya WHERE order_id = ?", [id]);
                await conn.query("DELETE FROM order_rute WHERE order_id = ?", [id]);
                oid = id;
            } else {
                data.nomor_order = await nomorDokumen("order", await panggilan(user.id));
                data.created_by = user.id;
                const kolom = Object.keys(data);
                const [res] = await conn.query(
                    `INSERT INTO orders (${kolom.map((k) => `\`${k}\``).join(", ")}) VALUES (${kolom.map(() => "?").join(", ")})`,
                    kolom.map((k) => data[k]),
                );
                oid = (res as { insertId: number }).insertId;
            }

            for (const it of items) {
                await conn.query(
                    `INSERT INTO order_items (order_id, unit_id, driver_id, partner_id, nama_unit, nopol, upgrade,
                        nama_driver, hp_driver, harga_modal_per_hari, harga_jual_per_hari, jumlah_hari,
                        subtotal_modal, subtotal_jual, catatan)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [
                        oid, it.unit_id || null, it.driver_id, it.partner_id, it.nama_unit, it.nopol,
                        it.upgrade !== "" ? it.upgrade : null,
                        it.nama_driver !== "" ? it.nama_driver : null,
                        it.hp_driver !== "" ? it.hp_driver : null,
                        it.harga_modal, it.harga_jual, it.jumlah_hari,
                        it.subtotal_modal, it.subtotal_jual,
                        it.catatan !== "" ? it.catatan : null,
                    ],
                );
            }

            /* RUTE TAMBAHAN — ditulis ulang tiap simpan agar urutannya sesuai layar. */
            const rDari = arr("rute_dari[]");
            const rKe = arr("rute_ke[]");
            const rTgl = arr("rute_tgl[]");
            const rJam = arr("rute_jam[]");
            const rCat = arr("rute_catatan[]");
            let urutRute = 0;
            for (let i = 0; i < rDari.length; i++) {
                const dari = rDari[i].trim();
                const ke = (rKe[i] ?? "").trim();
                const cat = (rCat[i] ?? "").trim();
                if (dari === "" && ke === "" && cat === "") {
                    continue;
                }
                const tgl = (rTgl[i] ?? "").trim();
                const jamR = (rJam[i] ?? "").trim();
                urutRute++;
                await conn.query(
                    "INSERT INTO order_rute (order_id, urutan, dari, ke, tgl, jam, catatan) VALUES (?,?,?,?,?,?,?)",
                    [
                        oid, urutRute,
                        dari !== "" ? dari : null,
                        ke !== "" ? ke : null,
                        /^\d{4}-\d{2}-\d{2}$/.test(tgl) ? tgl : null,
                        jamR !== "" ? jamR : null,
                        cat !== "" ? cat : null,
                    ],
                );
            }

            for (const iidRaw of form.getAll("include_id[]")) {
                const iid = Number(iidRaw);
                const nm = (await conn.query("SELECT nama FROM includes WHERE id = ? LIMIT 1", [iid]))[0] as Array<{ nama: string }>;
                if (!nm[0]?.nama) {
                    continue;
                }
                await conn.query(
                    "INSERT INTO order_includes (order_id, include_id, nama, biaya) VALUES (?,?,?,?)",
                    [oid, iid, nm[0].nama, angka(form.get(`include_biaya[${iid}]`) ?? 0)],
                );
            }

            const bNama = arr("biaya_nama[]");
            const bNom = arr("biaya_nominal[]");
            for (let i = 0; i < bNama.length; i++) {
                let bn = bNama[i].trim();
                const nom = angka(bNom[i] ?? 0);
                if (bn === "" && nom === 0) {
                    continue;
                }
                if (bn === "") {
                    bn = "Biaya tambahan";
                }
                await conn.query(
                    "INSERT INTO order_biaya (order_id, nama, nominal) VALUES (?,?,?)",
                    [oid, bn, nom],
                );
            }

            return oid;
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { errors: [`Gagal menyimpan pesanan: ${msg}`] };
    }

    const total = await hitungOrder(orderId);

    if (id > 0) {
        if (statusLama !== status) {
            await catatStatus(orderId, statusLama, status, "Status diubah dari form pesanan", user.nama);
        } else {
            await catatStatus(orderId, status, status, "Data pesanan diperbarui", user.nama);
        }
        const pesan = `Pesanan diperbarui. Total tagihan: ${rupiah(total.grand_total)}.`;
        return { errors: [], orderId, pesan };
    }

    await catatStatus(orderId, null, status, "Pesanan dibuat", user.nama);
    const nomor = (await queryOne<{ nomor_order: string }>(
        "SELECT nomor_order FROM orders WHERE id = ? LIMIT 1", [orderId],
    ))?.nomor_order ?? "";
    return { errors: [], orderId, pesan: `Pesanan tersimpan dengan nomor ${nomor}.` };
}

/** Harga modal default dari master unit (dipakai bila peran tidak boleh melihat modal). */
async function hargaModalMaster(unitId: number): Promise<number> {
    if (!unitId) {
        return 0;
    }
    const row = await queryOne<{ harga_modal_default: number }>(
        "SELECT harga_modal_default FROM units WHERE id = ? LIMIT 1", [unitId],
    );
    return Number(row?.harga_modal_default ?? 0);
}

/** Nama pendek user untuk prefix nomor order. */
async function panggilan(userId: number): Promise<string> {
    const { panggilanReservasi } = await import("@/lib/auth");
    return panggilanReservasi(userId);
}

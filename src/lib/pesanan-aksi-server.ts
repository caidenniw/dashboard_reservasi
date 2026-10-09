import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { query, queryOne, execute } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import {
    ambilOrder,
    catatStatus,
    nomorDokumen,
    formatRentang,
    type OrderLengkap,
} from "@/lib/app-lib";
import {
    angka,
    rupiah,
    labelWilayah,
    DAFTAR_STATUS,
    statusLabel,
    sekarangJakarta,
    sekarangJakartaWaktu,
} from "@/lib/format";
import type { FlashData } from "@/lib/flash";
import type { SesiUser } from "@/lib/auth";

/*
 * Aksi dokumen pesanan — port 1:1 dari PesananAksiController (yang sendiri salinan
 * pages/pesanan_aksi.php).
 *
 * Aturan yang dijaga sama:
 * - status dokumen invoice (terbit/sebagian/lunas/batal) hanya berubah lewat aksi ini;
 * - penomoran invoice lewat nomorDokumen('invoice') — urut global, nomor terkunci;
 * - panjar dari form otomatis jadi DP saat "terbit" (hindari duplikat);
 * - "revisi" memperbarui ISI invoice di tempat, NOMOR TETAP SAMA, pembayaran tetap menempel;
 * - status order ikut naik ke "paid" saat lunas dan turun lagi ke "invoiced" bila tidak lagi lunas;
 * - "batal" menandai invoice aktif jadi batal (pembayaran tetap tersimpan sebagai riwayat);
 * - "hapus" = soft delete (deleted_at), data tetap tersimpan.
 */

/** Hasil sebuah aksi: tujuan redirect + pesan flash (satu saja, seperti ->with()). */
export interface HasilAksi {
    tujuan: string;
    flash: FlashData;
}

const JENIS_INVOICE = new Set(["klasik", "modern"]);

/** Tanggal "YYYY-MM-DD" ditambah n hari (perilaku strtotime('+n days')). */
function tambahHari(tglYmd: string, n: number): string {
    const [y, m, d] = tglYmd.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    const p = (v: number) => String(v).padStart(2, "0");
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Nama user untuk kolom status_logs.oleh (port namaUser()). */
function namaUser(user: SesiUser): string {
    return user.nama || user.username || "admin";
}

/* ============================== UPLOAD BUKTI ============================== */

const IZIN_BUKTI = ["jpg", "jpeg", "png", "webp", "pdf"];
const MAKS_BUKTI = 5 * 1024 * 1024;

/** Port uploadBukti() dari app_lib.php — SIMPAN ke public/assets/uploads (bukan uploads/). */
export async function uploadBukti(
    berkas: File | null,
): Promise<{ ok: boolean; path: string; msg: string }> {
    if (!berkas) {
        return { ok: false, path: "", msg: "" };
    }
    const ext = (berkas.name.split(".").pop() ?? "").toLowerCase();
    if (!IZIN_BUKTI.includes(ext)) {
        return { ok: false, path: "", msg: "Bukti harus JPG/PNG/WEBP/PDF." };
    }
    if (berkas.size > MAKS_BUKTI) {
        return { ok: false, path: "", msg: "Ukuran bukti maksimal 5 MB." };
    }

    const tujuan = path.join(process.cwd(), "public", "assets", "uploads");
    await fs.mkdir(tujuan, { recursive: true });

    /* Nama berkas: bukti_Ymd_His_<8 hex>.<ext> — sama seperti date('Ymd_His') + bin2hex(random_bytes(4)). */
    const stempel = sekarangJakartaWaktu().replace(/[-: ]/g, "").slice(0, 15);
    const nama = `bukti_${stempel}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(tujuan, nama), Buffer.from(await berkas.arrayBuffer()));

    return { ok: true, path: `assets/uploads/${nama}`, msg: "Bukti terunggah." };
}

/* ============================== SNAPSHOT & BARIS INVOICE ============================== */

/** Snapshot customer + order (dipakai saat terbit maupun perbarui isi invoice). */
function snapshot(order: OrderLengkap): [string, string] {
    const custSnap = JSON.stringify({
        nama: order.nama_pesanan,
        pic: order.nama_pic,
        hp: order.hp_pic,
        alamat: order.customer_alamat ?? "",
        email: order.customer_email ?? "",
    });

    const includes = (order.includes as unknown as Array<{ nama: string }>) ?? [];
    const orderSnap = JSON.stringify({
        nomor_order: order.nomor_order,
        kota: order.kota,
        wilayah: order.wilayah_pelayanan,
        tgl_mulai: order.tgl_mulai,
        tgl_finish: order.tgl_finish,
        jumlah_hari: order.jumlah_hari,
        standby_point: order.standby_point,
        flight: order.flight,
        jam: order.jam,
        jam_koordinasi: order.jam_koordinasi,
        partner: order.partner_nama ?? "",
        include: includes.map((x) => x.nama).join("+"),
    });

    return [custSnap, orderSnap];
}

/** Rincian baris invoice (kolom mengikuti template invoice referensi). */
async function barisInvoice(order: OrderLengkap, invoiceId: number): Promise<void> {
    const includes = (order.includes as unknown as Array<{ nama: string }>) ?? [];
    const biaya = (order.biaya as unknown as Array<{ nama: string; nominal: number }>) ?? [];
    const incTeks = includes.map((x) => x.nama).join(" + ");

    const ins: unknown[][] = [];
    let urut = 0;

    for (const it of order.items) {
        urut++;
        let keterangan = `${it.nama_unit}\n${it.nopol}`;
        if (incTeks !== "") {
            keterangan += "\nInclude: " + incTeks;
        }
        /* Revisi #2: standby & jam tidak dicetak di invoice — rute hanya wilayah + kota + tujuan. */
        let rute = `${labelWilayah(String(order.wilayah_pelayanan))} ${order.kota}`;
        if (order.tujuan) {
            rute += "\n" + String(order.tujuan);
        }

        ins.push([
            invoiceId,
            urut,
            keterangan,
            it.nama_driver || "",
            formatRentang(String(order.tgl_mulai), String(order.tgl_finish)),
            rute,
            Number(it.harga_jual_per_hari),
            Number(it.jumlah_hari),
            Number(it.subtotal_jual),
        ]);
    }

    for (const b of biaya) {
        urut++;
        ins.push([invoiceId, urut, String(b.nama), "", "", "", Number(b.nominal), 1, Number(b.nominal)]);
    }

    if (ins.length > 0) {
        await execute(
            "INSERT INTO invoice_items (invoice_id, no, keterangan, driver, tanggal_pakai, rute, harga_hari, total_hari, total_harga) VALUES ?",
            [ins],
        );
    }
}

/* ============================== STATUS PEMBAYARAN ============================== */

/** Hitung ulang status pembayaran invoice dari tabel payments (port perbaruiInvoice). */
async function perbaruiInvoice(invoiceId: number, orderId: number, oleh: string): Promise<void> {
    const bayar = await queryOne<{ n: number }>(
        "SELECT COALESCE(SUM(nominal),0) n FROM payments WHERE invoice_id = ?",
        [invoiceId],
    );
    const dibayar = Number(bayar?.n ?? 0);
    const totalRow = await queryOne<{ total: number }>(
        "SELECT total FROM invoices WHERE id = ? LIMIT 1",
        [invoiceId],
    );
    const total = Number(totalRow?.total ?? 0);

    const sisa = Math.max(0, total - dibayar);
    const statusInv = dibayar <= 0 ? "terbit" : sisa === 0 ? "lunas" : "sebagian";

    await execute("UPDATE invoices SET dp = ?, sisa = ?, status = ? WHERE id = ?", [
        dibayar,
        sisa,
        statusInv,
        invoiceId,
    ]);

    /* status order mengikuti pembayaran - DUA ARAH. */
    const lamaRow = await queryOne<{ status: string }>("SELECT status FROM orders WHERE id = ? LIMIT 1", [orderId]);
    const lama = String(lamaRow?.status ?? "");

    if (statusInv === "lunas") {
        if (lama !== "paid") {
            await execute("UPDATE orders SET status = 'paid' WHERE id = ?", [orderId]);
            await catatStatus(orderId, lama, "paid", "Invoice lunas", oleh);
        }
    } else if (lama === "paid") {
        await execute("UPDATE orders SET status = 'invoiced' WHERE id = ?", [orderId]);
        await catatStatus(orderId, "paid", "invoiced", "Invoice tidak lagi lunas (pembayaran dihapus/diubah)", oleh);
    }
}

/* ============================== TERBIT / PERBARUI INVOICE ============================== */

interface InvAktif {
    id: number;
    nomor_invoice: string;
    jenis?: string | null;
    total: number;
    sisa: number;
    nomor_revisi_ke: number;
}

/** Invoice aktif = yang tidak batal (ambilOrder sudah mengurutkan id DESC). */
function invoiceAktif(order: OrderLengkap): InvAktif | null {
    const daftar = order.invoices as unknown as InvAktif[];
    return daftar.length > 0 ? daftar[0] : null;
}

/** Buat invoice baru dari data order (snapshot harga hari ini). */
async function terbitkanInvoice(
    order: OrderLengkap,
    userId: number,
    revisiKe = 0,
    menggantikan: string | null = null,
): Promise<{ id: number; nomor: string }> {
    const nomor = await nomorDokumen("invoice");
    const hariJatuhTempo = Number((await getSetting("invoice_jatuh_tempo_hari", "7")) || 7);
    const tanggal = sekarangJakarta();
    const jatuhTempo = tambahHari(tanggal, hariJatuhTempo);
    const total = Number(order.grand_total);

    let catatan = `Pesanan ${order.nomor_order} - ${order.nama_pesanan}`;
    if (menggantikan) {
        catatan += " | menggantikan " + menggantikan;
    }

    const [custSnap, orderSnap] = snapshot(order);

    const res = await execute(
        `INSERT INTO invoices
            (order_id, nomor_invoice, nomor_revisi_ke, tanggal_invoice, jatuh_tempo, total, dp, sisa, status,
             customer_snapshot, order_snapshot, catatan, issued_by, replaced_by, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'terbit', ?, ?, ?, ?, NULL, ?)`,
        [
            Number(order.id),
            nomor,
            revisiKe,
            tanggal,
            jatuhTempo,
            total,
            total,
            custSnap,
            orderSnap,
            catatan,
            userId,
            sekarangJakartaWaktu(),
        ],
    );

    const invoiceId = res.insertId;
    await barisInvoice(order, invoiceId);

    return { id: invoiceId, nomor };
}

/** Perbarui ISI invoice yang sudah terbit TANPA mengganti nomor (pembayaran tidak disentuh). */
async function perbaruiIsiInvoice(
    order: OrderLengkap,
    invoice: InvAktif,
): Promise<{ id: number; nomor: string }> {
    const invoiceId = Number(invoice.id);
    const nomor = String(invoice.nomor_invoice);
    const total = Number(order.grand_total);
    const revisiKe = Number(invoice.nomor_revisi_ke) + 1;

    const catatan =
        `Pesanan ${order.nomor_order} - ${order.nama_pesanan}` +
        (revisiKe > 0 ? ` | diperbarui ${revisiKe}x` : "");

    const [custSnap, orderSnap] = snapshot(order);

    await execute(
        `UPDATE invoices SET total = ?, nomor_revisi_ke = ?, customer_snapshot = ?, order_snapshot = ?, catatan = ?
         WHERE id = ?`,
        [total, revisiKe, custSnap, orderSnap, catatan, invoiceId],
    );

    await execute("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    await barisInvoice(order, invoiceId);

    return { id: invoiceId, nomor };
}

/* ============================== AKSI ============================== */

/**
 * Jalankan aksi dokumen pesanan.
 * @param id id pesanan (sama seperti $id di controller lama)
 * @param form isi form (multipart bila ada lampiran bukti)
 */
export async function jalankanAksi(
    id: number,
    form: FormData,
    user: SesiUser,
): Promise<HasilAksi | null> {
    const aksi = String(form.get("aksi") ?? "");
    const order = await ambilOrder(id);
    if (!order) {
        return null;
    }

    const kembali = `/pesanan/${id}`;
    const oleh = namaUser(user);

    /* Nama kolom status_logs.oleh: controller lama menulis nama user yang login. */
    switch (aksi) {
        case "status": {
            const baru = String(form.get("status_baru") ?? "");
            if (!(DAFTAR_STATUS as readonly string[]).includes(baru)) {
                return { tujuan: kembali, flash: { error: "Status tidak dikenal." } };
            }
            const lama = String(order.status);
            if (baru !== lama) {
                await execute("UPDATE orders SET status = ? WHERE id = ?", [baru, id]);
                const catatan = String(form.get("catatan_status") ?? "").trim() || "Diubah dari halaman detail";
                await catatStatus(id, lama, baru, catatan, oleh);
                return {
                    tujuan: kembali,
                    flash: { success: `Status pesanan diubah menjadi ${statusLabel(baru)}.` },
                };
            }
            return { tujuan: kembali, flash: { info: "Status tidak berubah." } };
        }

        case "opsi_cetak": {
            /* Revisi #3 & #5: pilih template invoice + opsi bank dari halaman detail pesanan. */
            const tmplRaw = String(form.get("template_invoice") ?? "").trim();
            const tmpl = tmplRaw === "" ? "klasik" : tmplRaw;
            const template = JENIS_INVOICE.has(tmpl) ? tmpl : "klasik";
            const bank = String(form.get("bank_invoice") ?? "").trim();
            await execute("UPDATE orders SET template_invoice = ?, bank_invoice = ? WHERE id = ?", [
                template,
                bank !== "" ? bank : null,
                id,
            ]);
            return {
                tujuan: kembali,
                flash: {
                    success:
                        `Opsi cetak invoice disimpan: template "${template === "modern" ? "Modern 1000" : "Klasik"}"` +
                        (bank !== "" ? `, bank ${bank}` : ", semua bank") +
                        ".",
                },
            };
        }

        case "jadikan_final": {
            /* Revisi 21: invoice AWAL (sementara) dijadikan FINAL oleh Finance / Super Admin.
               Nomor invoice TETAP SAMA — hanya status jenis yang berubah. */
            const invFinal = invoiceAktif(order);
            if (!invFinal) {
                return { tujuan: kembali, flash: { warning: "Belum ada invoice yang diterbitkan pada pesanan ini." } };
            }
            if ((invFinal.jenis ?? "sementara") === "final") {
                return {
                    tujuan: kembali,
                    flash: { info: `Invoice ${invFinal.nomor_invoice} sudah berstatus FINAL.` },
                };
            }
            await execute("UPDATE invoices SET jenis = 'final', final_at = ?, final_by = ? WHERE id = ?", [
                sekarangJakartaWaktu(),
                user.id,
                Number(invFinal.id),
            ]);
            await catatStatus(
                id,
                null,
                String(order.status),
                `Invoice ${invFinal.nomor_invoice} dijadikan FINAL oleh ${oleh}`,
                oleh,
            );
            return {
                tujuan: kembali,
                flash: {
                    success:
                        `Invoice ${invFinal.nomor_invoice} sekarang berstatus FINAL. ` +
                        "Nomor invoice tetap sama; cetak ulang untuk lembar final.",
                },
            };
        }

        case "terbit": {
            const aktif = invoiceAktif(order);
            if (aktif) {
                return {
                    tujuan: kembali,
                    flash: {
                        warning:
                            `Invoice sudah terbit: ${aktif.nomor_invoice}. Gunakan tombol Perbarui Invoice ` +
                            "kalau ada yang perlu diubah (nomor tetap sama).",
                    },
                };
            }
            const invBaru = await terbitkanInvoice(order, user.id);
            const nomor = invBaru.nomor;

            /* Panjar otomatis jadi DP — input sekali di form, tidak input lagi di halaman ini. */
            let panjar = Number(order.panjar ?? 0);
            if (panjar > 0) {
                panjar = Math.min(panjar, Number(order.grand_total));
                const sudahAda = await queryOne<{ n: number }>(
                    "SELECT COUNT(*) n FROM payments WHERE invoice_id = ? AND catatan = ?",
                    [invBaru.id, "Panjar awal dari form pesanan"],
                );
                if (Number(sudahAda?.n ?? 0) === 0) {
                    await execute(
                        `INSERT INTO payments
                            (invoice_id, tanggal_bayar, tipe, nominal, metode, bank, bukti_path, catatan, created_by)
                         VALUES (?, ?, 'dp', ?, 'transfer', '', '', 'Panjar awal dari form pesanan', ?)`,
                        [invBaru.id, sekarangJakarta(), panjar, user.id],
                    );
                    await perbaruiInvoice(invBaru.id, id, oleh);
                }
            }

            /* CATATAN: sama seperti sistem lama, catatStatus tetap dipanggil walau
               update status di bawah dilewati (order sudah paid/reported). */
            await execute("UPDATE orders SET status = 'invoiced' WHERE id = ? AND status NOT IN ('paid','reported')", [id]);
            await catatStatus(
                id,
                String(order.status),
                "invoiced",
                `Invoice diterbitkan: ${nomor}` +
                    (panjar > 0 ? ` (panjar ${rupiah(panjar)} otomatis jadi DP)` : ""),
                oleh,
            );

            return {
                tujuan: kembali,
                flash: {
                    success:
                        `Invoice ${nomor} diterbitkan.` +
                        (panjar > 0 ? ` Panjar ${rupiah(panjar)} otomatis tercatat sebagai DP.` : "") +
                        " Ada perubahan? Pakai Perbarui Invoice (nomor tetap sama).",
                },
            };
        }

        case "revisi": {
            const inv = invoiceAktif(order);
            if (!inv) {
                return { tujuan: kembali, flash: { error: "Belum ada invoice untuk diperbarui." } };
            }
            const nomor = String(inv.nomor_invoice);
            const totalLama = Number(inv.total);
            const totalBaru = Number(order.grand_total);

            /* isi invoice diperbarui di tempat: nomor TETAP SAMA. Pembayaran tidak dipindah. */
            await perbaruiIsiInvoice(order, inv);
            await perbaruiInvoice(Number(inv.id), id, oleh);

            await execute("UPDATE orders SET status = 'invoiced' WHERE id = ? AND status NOT IN ('paid','reported')", [id]);

            const ubah =
                totalLama !== totalBaru
                    ? `total ${rupiah(totalLama)} -> ${rupiah(totalBaru)}`
                    : "rincian/tanggal diperbarui";
            await catatStatus(
                id,
                String(order.status),
                String(order.status),
                `Invoice ${nomor} diperbarui (nomor tetap): ${ubah}`,
                oleh,
            );

            return {
                tujuan: kembali,
                flash: {
                    success:
                        `Invoice ${nomor} diperbarui. Nomor invoice TIDAK berubah. ` +
                        (totalLama !== totalBaru
                            ? `Total: ${rupiah(totalLama)} menjadi ${rupiah(totalBaru)}. `
                            : "") +
                        "Pembayaran yang sudah masuk tetap menempel.",
                },
            };
        }

        case "bayar": {
            const invoice = invoiceAktif(order);
            if (!invoice) {
                return {
                    tujuan: kembali,
                    flash: { error: "Terbitkan invoice dulu sebelum mencatat pembayaran." },
                };
            }
            const nominal = angka(form.get("nominal") ?? 0);
            if (nominal <= 0) {
                return { tujuan: kembali, flash: { error: "Nominal pembayaran wajib lebih dari 0." } };
            }

            const tglBayar = String(form.get("tanggal_bayar") ?? "").trim() || sekarangJakarta();
            const tipeBayar = String(form.get("tipe") ?? "pelunasan");
            const metode = String(form.get("metode") ?? "transfer");
            const bank = String(form.get("bank") ?? "").trim();
            const catatanBayar = String(form.get("catatan_bayar") ?? "").trim();

            let bukti = "";
            const berkas = form.get("bukti");
            if (berkas instanceof File && berkas.size > 0) {
                const up = await uploadBukti(berkas);
                if (!up.ok) {
                    return { tujuan: kembali, flash: { error: up.msg } };
                }
                bukti = up.path;
            }

            const sisaSekarang = Number(invoice.sisa);
            if (nominal > sisaSekarang) {
                return {
                    tujuan: kembali,
                    flash: {
                        error:
                            `Nominal melebihi sisa tagihan (${rupiah(sisaSekarang)}). Periksa kembali.`,
                    },
                };
            }

            await execute(
                `INSERT INTO payments
                    (invoice_id, tanggal_bayar, tipe, nominal, metode, bank, bukti_path, catatan, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [Number(invoice.id), tglBayar, tipeBayar, nominal, metode, bank, bukti, catatanBayar, user.id],
            );
            await perbaruiInvoice(Number(invoice.id), id, oleh);

            return { tujuan: kembali, flash: { success: `Pembayaran ${rupiah(nominal)} dicatat.` } };
        }

        case "hapus_bayar": {
            const pid = Number(form.get("payment_id") ?? 0);
            const aktif = invoiceAktif(order);
            if (!aktif || pid <= 0) {
                return { tujuan: kembali, flash: { error: "Pembayaran tidak ditemukan." } };
            }
            const invId = Number(aktif.id);
            await execute("DELETE FROM payments WHERE id = ? AND invoice_id = ?", [pid, invId]);
            await perbaruiInvoice(invId, id, oleh);

            return { tujuan: kembali, flash: { success: "Catatan pembayaran dihapus." } };
        }

        case "batal": {
            const alasan = String(form.get("alasan") ?? "").trim() || "Dibatalkan";

            /* Invoice aktif ikut ditandai batal; catatan pembayaran TIDAK dihapus. */
            const invAktifBatal = invoiceAktif(order);
            const nomorDibatalkan: string[] = [];
            if (invAktifBatal) {
                await execute("UPDATE invoices SET status = 'batal', sisa = 0 WHERE id = ?", [
                    Number(invAktifBatal.id),
                ]);
                nomorDibatalkan.push(String(invAktifBatal.nomor_invoice));
            }

            await execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [id]);
            await catatStatus(
                id,
                String(order.status),
                "cancelled",
                alasan +
                    (nomorDibatalkan.length > 0
                        ? " | invoice ditandai batal: " + nomorDibatalkan.join(", ")
                        : ""),
                oleh,
            );

            return {
                tujuan: kembali,
                flash: {
                    success:
                        "Pesanan dibatalkan." +
                        (nomorDibatalkan.length > 0
                            ? ` Invoice ${nomorDibatalkan.join(", ")} ikut ditandai batal; catatan pembayaran tetap tersimpan.`
                            : ""),
                },
            };
        }

        case "hapus": {
            await execute("UPDATE orders SET deleted_at = ? WHERE id = ?", [sekarangJakartaWaktu(), id]);
            return {
                tujuan: "/pesanan",
                flash: {
                    success: "Pesanan dihapus dari daftar (data tetap tersimpan di database).",
                },
            };
        }

        default:
            return { tujuan: kembali, flash: { error: "Aksi tidak dikenal." } };
    }
}

/* ============================== UNGGAH BUKTI PEMBAYARAN ============================== */

/** POST /pesanan/{id}/bukti — unggah/ganti berkas bukti untuk pembayaran $id. */
export async function gantiBuktiBayar(
    paymentId: number,
    form: FormData,
): Promise<{ tujuan: string; flash: FlashData }> {
    const payment = await queryOne<{ id: number }>("SELECT id FROM payments WHERE id = ? LIMIT 1", [paymentId]);
    if (!payment) {
        return { tujuan: "/pesanan", flash: { error: "Bukti tidak ditemukan." } };
    }

    const berkas = form.get("bukti");
    if (!(berkas instanceof File) || berkas.size === 0) {
        return {
            tujuan: `/pesanan/${paymentId}/bukti`,
            flash: { error: "Pilih berkas bukti terlebih dahulu." },
        };
    }

    const up = await uploadBukti(berkas);
    if (!up.ok) {
        return { tujuan: `/pesanan/${paymentId}/bukti`, flash: { error: up.msg } };
    }

    await execute("UPDATE payments SET bukti_path = ? WHERE id = ?", [up.path, paymentId]);

    return { tujuan: `/pesanan/${paymentId}/bukti`, flash: { success: up.msg } };
}

/** Daftar pembayaran pada satu invoice, urut tanggal_bayar lalu id (port daftarBukti). */
export async function daftarBukti(invoiceId: number): Promise<Payment[]> {
    return query<Payment>(
        "SELECT * FROM payments WHERE invoice_id = ? ORDER BY tanggal_bayar, id",
        [invoiceId],
    );
}

export interface Payment {
    id: number;
    invoice_id: number;
    tanggal_bayar: string;
    tipe: string;
    nominal: number;
    metode: string;
    bank: string | null;
    bukti_path: string | null;
    catatan: string | null;
    created_by: number | null;
}

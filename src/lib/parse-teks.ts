import { sekarangJakarta } from "@/lib/format";

/*
 * ParseTeks — port PERSIS legacy-laravel/app/Support/ParseTeks.php
 * (yang sendiri menyalin includes/parse_teks_lib.php sistem lama).
 *
 * Mesin pembaca teks konfirmasi reservasi (format template teksWaOrder) menjadi
 * data pesanan terstruktur.
 *
 * Sifat yang dipertahankan:
 * - MURNI teks: tidak menyentuh database (pencocokan ke master di lib pemanggil).
 * - Deterministik: mengikuti label baris template kita sendiri.
 * - Jujur: baris yang tidak dikenali TIDAK ditebak, tapi dilaporkan lewat kunci
 *   'tidak_dikenali' supaya bisa diisi manual.
 *
 * Catatan "Hp/Wa" yang muncul DUA kali (driver & PIC): urutan baris dipakai untuk
 * membedakan, bukan sekadar mencari label pertama.
 *
 * JANGAN menyederhanakan regex/urutan di sini: hasilnya sudah diuji diferensial
 * terhadap versi PHP-nya.
 */

/* ============================== UTILITAS KECIL ============================== */

/** Nilai setelah titik dua; "-" atau kosong dianggap tidak ada. */
export function pnNilai(v: string): string {
    const s = String(v ?? "").trim();
    if (s === "" || s === "-" || s === "\u2013") {
        return "";
    }
    return s;
}

/** Ambil angka dari teks rupiah/angka lain. "Rp 300.000" -> 300000. */
export function pnAngka(s: string): number {
    const digit = String(s ?? "").replace(/[^0-9]/g, "");
    return digit === "" ? 0 : parseInt(digit, 10);
}

const BULAN_ID: Record<string, number> = {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7,
    agu: 8, ags: 8, agt: 8, aug: 8, sep: 9, sept: 9,
    okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** date('Y-m-d', strtotime("+n days")) untuk teks tanggal (UTC, tanpa geser zona). */
function geserHari(tgl: string, n: number): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tgl) as RegExpExecArray;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
    return d.toISOString().slice(0, 10);
}

/** Normalisasi tanggal apa pun (d-m-Y / Y-m-d / d/m/Y / "3 Oktober 2026") -> Y-m-d, atau '' bila gagal. */
export function pnTanggal(t: string): string {
    const teks = String(t ?? "").trim();

    /* Nama bulan Indonesia (lengkap & singkatan) — pesan WA pelanggan sering pakai ini */
    const mNama = /^(\d{1,2})\s+([A-Za-z]+)\.?\s*(\d{2,4})?$/.exec(teks);
    if (mNama) {
        const bl = mNama[2].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(BULAN_ID, bl)) {
            let y = mNama[3] && mNama[3] !== "" ? parseInt(mNama[3], 10) : parseInt(sekarangJakarta().slice(0, 4), 10);
            if (y < 100) {
                y += 2000;
            }
            const hari = parseInt(mNama[1], 10);
            if (hari >= 1 && hari <= 31) {
                return `${String(y).padStart(4, "0")}-${pad2(BULAN_ID[bl])}-${pad2(hari)}`;
            }
        }
    }

    const mAngka = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(teks);
    if (!mAngka) {
        return "";
    }
    const a = parseInt(mAngka[1], 10);
    const b = parseInt(mAngka[2], 10);
    const c = parseInt(mAngka[3], 10);
    let y: number;
    let mo: number;
    let d: number;
    if (a > 31 || mAngka[1].length === 4) {
        /* sudah Y-m-d */
        y = a;
        mo = b;
        d = c;
    } else {
        /* d-m-Y */
        d = a;
        mo = b;
        y = c;
    }
    if (y < 100) {
        y += 2000;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
        return "";
    }
    return `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(d)}`;
}

/**
 * Rentang tanggal dari satu baris "Tanggal :".
 * Mendukung: "03-10-2026 s/d 05-10-2026" dan "3 Oktober 2026 s/d 5 Oktober 2026"
 * maupun satu tanggal saja.
 */
export function pnRentang(val: string): [string, string] {
    const s = String(val ?? "").trim();

    /* bentuk angka: 03-10-2026 s/d 05-10-2026 */
    const mRentang = /(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s*(?:s\s*\/\s*d|s\.d\.|sd|sampai|hingga|to|s\/d)\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i.exec(s);
    if (mRentang) {
        return [pnTanggal(mRentang[1]), pnTanggal(mRentang[2])];
    }

    /* bentuk nama bulan (mis. "3 Oktober 2026 - 5 Oktober 2026" / "3 s/d 5 Oktober 2026") */
    const semua: string[] = [...(s.match(/(\d{1,2}\s+[A-Za-z]+\.?\s*\d{2,4}|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/g) ?? [])];
    if (semua.length >= 2) {
        const a = pnTanggal(semua[0].trim());
        const b = pnTanggal(semua[1].trim());
        if (a !== "" && b !== "") {
            return [a, b];
        }
    }

    /* satu tanggal saja */
    const satu = /(\d{1,2}\s+[A-Za-z]+\.?\s*\d{2,4}|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/.exec(s);
    if (satu) {
        return [pnTanggal(satu[1].trim()), ""];
    }

    return ["", ""];
}

/**
 * Angka rupiah gaya pesan cepat: "650" -> 650000 (shorthand ribuan),
 * "650rb"/"650 k" -> 650000, "1,5jt"/"1.5 juta" -> 1500000, "900.000" -> 900000.
 */
export function pnAngkaRibu(s: string): number {
    const teks = String(s ?? "").toLowerCase().trim();
    const mJuta = /([\d.,]+)\s*(jt|juta)/.exec(teks);
    if (mJuta) {
        const n = parseFloat(mJuta[1].replace(/\./g, "").replace(/,/g, "."));
        return Math.round(n * 1000000);
    }
    const mRibu = /([\d.,]+)\s*(rb|ribu|k)\b/.exec(teks);
    if (mRibu) {
        const n = parseFloat(mRibu[1].replace(/\./g, "").replace(/,/g, "."));
        return Math.round(n * 1000);
    }
    let n = parseInt(teks.replace(/[^0-9]/g, "") || "0", 10);
    if (n > 0 && n < 1000) {
        n *= 1000; /* "650" -> 650.000 */
    }
    return n;
}

/** "A+B", "A, B", "A dan B" -> daftar nama include. */
export function pnIncludes(v: string): string[] {
    const nilai = pnNilai(v);
    if (nilai === "") {
        return [];
    }
    const out: string[] = [];
    for (const b of nilai.split(/\s*[+,]\s*|\s+dan\s+/i)) {
        const t = b.trim();
        if (t !== "" && t !== "-") {
            out.push(t);
        }
    }
    return out;
}

/**
 * Awalan "Mobil + Driver" pada Include -> nama-nama yang bisa dicocokkan ke master.
 * "Mobil + Driver + BBM + Tol" -> [Mobil + Driver, BBM, Tol]
 */
export function pnIncludesMaster(v: string): string[] {
    const out: string[] = [];
    const gabung: string[] = [];
    for (const n of pnIncludes(v)) {
        if (/^mobil\b/i.test(n) || /^driver\b/i.test(n)) {
            gabung.push(n);
            continue;
        }
        out.push(n);
    }
    if (gabung.length > 0) {
        out.unshift(gabung.join(" + "));
    }
    return out;
}

/** Baris pemisah antar armada, mis. "- - - - - - -". */
export function pnSeparator(ln: string): boolean {
    return ln !== "" && !ln.includes("_") && /^[-\s]+$/.test(ln) && (ln.match(/-/g)?.length ?? 0) >= 3;
}

/** "Dalam Kota Medan" / "Luar Kota Gunung Sitoli" -> [wilayah, kota]. */
export function pnPelayanan(v: string): [string, string] {
    const teks = String(v ?? "").trim();
    const low = teks.toLowerCase();
    let wilayah = "dalam_kota";
    if (/\bluar\b|\bluarkota\b/i.test(low)) {
        wilayah = "luar_kota";
    }
    let kota = teks.replace(/^\s*(dalam|luar)\s*kota\b/i, "");
    /* trim " \t:-|" dari kedua ujung (sama seperti trim($kota, " \t:-|")). */
    kota = kota.replace(/^[ \t:\-|]+/, "").replace(/[ \t:\-|]+$/, "");
    return [wilayah, kota];
}

/* ============================== PARSER UTAMA ============================== */

export interface ItemTeks {
    nama_driver: string;
    hp_driver: string;
    nama_unit: string;
    nopol: string;
    harga_jual_per_hari: number;
    harga_modal_per_hari?: number;
}

export interface DataTeks {
    wilayah_pelayanan: string;
    kota: string;
    tgl_mulai: string;
    tgl_finish: string;
    jumlah_hari: number;
    jam: string;
    jam_koordinasi: number;
    standby_point: string;
    flight: string;
    nama_pesanan: string;
    nama_pic: string;
    hp_pic: string;
    support_by?: string;
}

export interface HasilParseTeks {
    data: DataTeks;
    items: ItemTeks[];
    includes: string[];
    biaya: Array<{ nama: string; nominal: number }>;
    total_teks: number;
    tidak_dikenali: string[];
    catatan: string[];
    yakin: number;
}

/** Baca teks konfirmasi pesanan menjadi data terstruktur (port parseTeksPesanan). */
export function parseTeksPesanan(teks: string): HasilParseTeks {
    const hasil: HasilParseTeks = {
        data: {
            wilayah_pelayanan: "dalam_kota",
            kota: "",
            tgl_mulai: "",
            tgl_finish: "",
            jumlah_hari: 0,
            jam: "",
            jam_koordinasi: 0,
            standby_point: "",
            flight: "",
            nama_pesanan: "",
            nama_pic: "",
            hp_pic: "",
        },
        items: [],
        includes: [],
        biaya: [],
        total_teks: 0,
        tidak_dikenali: [],
        catatan: [],
        yakin: 0,
    };

    /* --- normalisasi baris --- */
    const raw = String(teks ?? "")
        .replace(/\r\n|\r/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/\t/g, " ");
    const lines = raw.split("\n").map((l) => {
        /* Buang penanda tebal/miring WHATSAPP (*teks* dan _teks_) supaya label
           seperti "*Pelayanan :*" tetap terbaca sebagai "Pelayanan :". */
        let s = l.replace(/\*/g, "").replace(/\u200b/g, "");
        s = s.replace(/^[ _\t]+/, "").replace(/[ _\t]+$/, "");
        return s.replace(/ {2,}/g, " ").trim();
    });

    /* --- 1. BLOK ARMADA (unit/driver), berbasis urutan baris --- */
    let current: ItemTeks | null = null;
    const tutup = () => {
        if (current !== null && (current.nama_unit !== "" || current.nopol !== "" || current.nama_driver !== "")) {
            hasil.items.push(current);
        }
        current = null;
    };
    for (const ln of lines) {
        if (ln === "") {
            continue;
        }
        if (pnSeparator(ln)) {
            tutup();
            continue;
        }

        const mDriver = /^nama\s*driver\s*:\s*(.*)$/i.exec(ln);
        if (mDriver) {
            tutup(); // armada sebelumnya selesai
            current = { nama_driver: pnNilai(mDriver[1]), hp_driver: "", nama_unit: "", nopol: "", harga_jual_per_hari: 0 };
            continue;
        }
        if (current !== null) {
            const mHp = /^hp\s*\/?\s*wa\s*:\s*(.*)$/i.exec(ln);
            if (mHp) {
                current.hp_driver = pnNilai(mHp[1]);
                continue;
            }
            const mUnit = /^unit\s*:\s*(.*)$/i.exec(ln);
            if (mUnit) {
                current.nama_unit = pnNilai(mUnit[1]);
                continue;
            }
            const mPlat = /^(?:no\.?\s*plat|nopol|plat)\s*:\s*(.*)$/i.exec(ln);
            if (mPlat) {
                current.nopol = pnNilai(mPlat[1]).toUpperCase();
                continue;
            }
            tutup(); // baris lain menandakan blok armada sudah lewat
        }
    }
    tutup();

    /* --- 2. BARIS LAINNYA (pelayanan, tanggal, meta, customer, harga) --- */
    let sawPic = false;
    const hargaMap = new Map<string, number>();

    for (const ln of lines) {
        if (ln === "") {
            continue;
        }

        // item & separator sudah ditangani di atas -> jangan diproses lagi
        if (/^nama\s*driver\s*:/i.test(ln) || /^unit\s*:/i.test(ln) || /^(?:no\.?\s*plat|nopol|plat)\s*:/i.test(ln) || pnSeparator(ln)) {
            continue;
        }

        // "Support by om safi" (boleh tanpa titik dua) -> info vendor/support
        const mSupport = /^support\s*by\s*:?\s*(.+)$/i.exec(ln);
        if (mSupport) {
            hasil.data.support_by = pnNilai(mSupport[1]);
            continue;
        }

        // footer & identitas perusahaan: dilewati, tidak dianggap "tidak dikenali"
        if (/^(instagram|website|email|terimakasih|1000\s*rent\s*car|pt\.?\s)/i.test(ln)
            || ln.toLowerCase().includes("www.") || ln.includes("@") || !ln.includes(":")) {
            continue;
        }

        const mPelayanan = /^pelayanan\s*:\s*(.*)$/i.exec(ln);
        if (mPelayanan) {
            const [wil, kota] = pnPelayanan(mPelayanan[1]);
            hasil.data.wilayah_pelayanan = wil;
            hasil.data.kota = kota;
            continue;
        }

        const mTanggal = /^tanggal\s*:\s*(.*)$/i.exec(ln);
        if (mTanggal) {
            const val = mTanggal[1];
            const [t1, t2] = pnRentang(val);
            if (t1 !== "") {
                hasil.data.tgl_mulai = t1;
            }
            if (t2 !== "") {
                hasil.data.tgl_finish = t2;
            }
            const mHari = /\((\d{1,3})\s*(?:day|hari)\)/i.exec(val);
            if (mHari) {
                hasil.data.jumlah_hari = parseInt(mHari[1], 10);
                if (t1 !== "") {
                    /* durasi tertulis -> tanggal selesai dihitung */
                    hasil.data.tgl_finish = geserHari(t1, parseInt(mHari[1], 10) - 1);
                }
            } else if (t1 !== "" && t2 === "") {
                /* hanya satu tanggal di teks -> anggap 1 hari + beri catatan supaya diperiksa */
                hasil.data.tgl_finish = t1;
                hasil.catatan.push("Teks hanya memuat SATU tanggal — jumlah hari dianggap 1 hari; isi tanggal selesai bila sewanya lebih dari sehari.");
            }
            continue;
        }

        const mStanby = /^stanby\s*:\s*(.*)$/i.exec(ln);
        if (mStanby) {
            hasil.data.standby_point = pnNilai(mStanby[1]);
            continue;
        }
        const mFlight = /^flight\s*:\s*(.*)$/i.exec(ln);
        if (mFlight) {
            hasil.data.flight = pnNilai(mFlight[1]);
            continue;
        }

        const mJam = /^jam\s*:\s*(.*)$/i.exec(ln);
        if (mJam) {
            const j = mJam[1].trim();
            const jl = j.toLowerCase();
            if (jl.includes("kordinasi") || jl.includes("koordinasi")) {
                hasil.data.jam_koordinasi = 1;
            } else {
                hasil.data.jam = pnNilai(j);
            }
            continue;
        }

        const mPesanan = /^pesanan\s*:\s*(.*)$/i.exec(ln);
        if (mPesanan) {
            hasil.data.nama_pesanan = mPesanan[1].trim();
            sawPic = false;
            continue;
        }
        const mPic = /^pic\s*:\s*(.*)$/i.exec(ln);
        if (mPic) {
            hasil.data.nama_pic = pnNilai(mPic[1]);
            sawPic = true;
            continue;
        }
        const mHpPic = /^hp\s*\/?\s*wa\s*:\s*(.*)$/i.exec(ln);
        if (mHpPic) {
            // hanya diterima sebagai HP PIC bila muncul SETELAH baris "Pic :"
            if (sawPic && hasil.data.hp_pic === "") {
                hasil.data.hp_pic = pnNilai(mHpPic[1]);
            }
            continue;
        }

        const mInclude = /^include\s*:\s*(.*)$/i.exec(ln);
        if (mInclude) {
            hasil.includes = pnIncludesMaster(mInclude[1]);
            continue;
        }

        const mHarga = /^harga\s+(.+?)\s*:\s*(.+)$/i.exec(ln);
        if (mHarga) {
            hargaMap.set(mHarga[1].trim().toLowerCase(), pnAngka(mHarga[2]));
            continue;
        }

        const mTotal = /^total\s*:\s*(.+)$/i.exec(ln);
        if (mTotal) {
            // ambil hanya angka rupiah pertama; "(3 hari)" di belakang jangan ikut terbaca
            const mAngka = /([\d][\d.,]*)/.exec(mTotal[1]);
            hasil.total_teks = mAngka ? pnAngka(mAngka[1]) : 0;
            continue;
        }

        /* shorthand "modal : 650" / "jual : 900" (satuan ribuan rupiah per hari) */
        const mShorthand = /^(?:harga\s+)?(modal|jual)\s*:\s*(.+)$/i.exec(ln);
        if (mShorthand) {
            const angka = pnAngkaRibu(mShorthand[2]);
            if (angka > 0) {
                const kunci = mShorthand[1].toLowerCase() === "modal" ? "harga_modal_per_hari" : "harga_jual_per_hari";
                if (hasil.items.length > 0) {
                    if (kunci === "harga_modal_per_hari") {
                        hasil.items[0].harga_modal_per_hari = angka;
                    } else {
                        hasil.items[0].harga_jual_per_hari = angka;
                    }
                    if (hasil.items.length > 1) {
                        hasil.catatan.push(`"${mShorthand[1]} : ${mShorthand[2].trim()}" dipasang ke unit PERTAMA saja — sesuaikan bila beda per unit.`);
                    }
                } else {
                    hasil.biaya.push({ nama: mShorthand[1].toLowerCase(), nominal: angka });
                }
            }
            continue;
        }

        const mBiaya = /^(.+?)\s*:\s*(?:rp\s*)?[\d.,]+\s*$/i.exec(ln);
        if (mBiaya) {
            /* Perhatikan: regex ini hanya punya SATU grup tangkap, jadi PHP memakai
               `$m[2] ?? $ln` -> nominal dihitung dari SELURUH baris. Dipertahankan. */
            hasil.biaya.push({ nama: mBiaya[1].trim(), nominal: pnAngka(ln) });
            continue;
        }

        hasil.tidak_dikenali.push(ln);
    }

    /* --- 3. tempelkan harga jual dari blok "Harga <unit>" ke item terkait --- */
    if (hargaMap.size > 0) {
        for (const it of hasil.items) {
            const nama = String(it.nama_unit ?? "").toLowerCase();
            let harga: number | null = null;
            if (nama !== "" && hargaMap.has(nama)) {
                harga = hargaMap.get(nama) as number;
            } else {
                for (const [k, v] of hargaMap) {
                    if (nama !== "" && (k.includes(nama) || nama.includes(k))) {
                        harga = v;
                        break;
                    }
                }
            }
            it.harga_jual_per_hari = harga ?? 0;
        }
    }
    /* pastikan semua item punya kunci harga walau teks tanpa blok harga */
    for (const it of hasil.items) {
        if (it.harga_jual_per_hari === undefined || it.harga_jual_per_hari === null) {
            it.harga_jual_per_hari = 0;
        }
    }

    /* --- 4. hitung jumlah hari bila tidak tertulis --- */
    if (hasil.data.jumlah_hari <= 0 && hasil.data.tgl_mulai !== "" && hasil.data.tgl_finish !== "") {
        const selisih = (Date.parse(`${hasil.data.tgl_finish}T00:00:00Z`) - Date.parse(`${hasil.data.tgl_mulai}T00:00:00Z`)) / 86400000 + 1;
        hasil.data.jumlah_hari = Math.max(1, Math.round(selisih));
    }

    /* --- 5. keyakinan & catatan --- */
    let skor = 0;
    if (hasil.data.kota !== "") {
        skor += 10;
    }
    if (hasil.data.tgl_mulai !== "") {
        skor += 25;
    }
    if (hasil.data.tgl_finish !== "") {
        skor += 10;
    }
    if (hasil.data.nama_pesanan !== "") {
        skor += 25;
    }
    if (hasil.items.length > 0) {
        skor += 30;
    }
    skor -= Math.min(45, hasil.tidak_dikenali.length * 15);
    hasil.yakin = Math.max(0, Math.min(100, skor));

    if (hasil.tidak_dikenali.length > 0) {
        hasil.catatan.push(`${hasil.tidak_dikenali.length} baris tidak dikenali (perlu diperiksa manual).`);
    }
    if (hasil.total_teks > 0 && hasil.items.length > 0) {
        let jual = 0;
        for (const it of hasil.items) {
            jual += Number(it.harga_jual_per_hari ?? 0) * Number(hasil.data.jumlah_hari);
        }
        for (const b of hasil.biaya) {
            jual += Number(b.nominal);
        }
        if (jual > 0 && jual !== hasil.total_teks) {
            hasil.catatan.push(
                `Total di teks (Rp ${hasil.total_teks.toLocaleString("id-ID")}) tidak sama dengan hitungan item + biaya (Rp ${jual.toLocaleString("id-ID")}). Periksa manual.`,
            );
        }
    }

    return hasil;
}

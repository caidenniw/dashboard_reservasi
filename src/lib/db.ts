import mysql from "mysql2/promise";

/*
 * Koneksi database MySQL.
 *
 * ATURAN PENTING (lihat database/README-SKEMA.md):
 * Database `rentalnusantara` dipakai bersama sistem lama dan berisi data
 * operasional nyata. Modul ini HANYA menjalankan query (SELECT/INSERT/UPDATE),
 * TIDAK PERNAH menjalankan DDL atau migrasi. Jangan tambahkan perintah yang
 * mengubah struktur tabel di sini.
 */

let _pool: mysql.Pool | null = null;

/** Pool koneksi tunggal (dibuat sekali, dipakai ulang). */
export function db(): mysql.Pool {
    if (!_pool) {
        _pool = mysql.createPool({
            host: process.env.DB_HOST ?? "127.0.0.1",
            port: Number(process.env.DB_PORT ?? 3306),
            /* Selaras dengan nama variabel Laravel (DB_USERNAME/DB_DATABASE),
               dengan dukungan nama singkat sebagai cadangan. */
            user: process.env.DB_USERNAME ?? process.env.DB_USER ?? "root",
            password: process.env.DB_PASSWORD ?? "",
            database: process.env.DB_DATABASE ?? process.env.DB_NAME ?? "rentalnusantara",

            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,

            /* Charset & collation harus sama dengan database supaya LIKE/pencarian
               berperilaku identik (DB memakai utf8mb4_unicode_ci). */
            charset: "utf8mb4",

            /* Jangan pernah mengizinkan banyak statement per query. */
            multipleStatements: false,

            /*
             * `dateStrings: true` WAJIB.
             * Secara bawaan mysql2 mengubah kolom DATE/DATETIME menjadi objek Date
             * JavaScript dan menggeser zona waktu. Sistem lama (PHP) selalu menerima
             * tanggal sebagai teks ('2026-10-03'), jadi opsi ini menjaga perilaku sama
             * persis dan mencegah tanggal bergeser satu hari.
             */
            dateStrings: true,

            /* Zona waktu sesi MySQL = Asia/Jakarta (sama seperti config/app.php). */
            timezone: "+07:00",

            /* Angka besar (bigint) tetap aman sebagai number selama < 2^53. */
            supportBigNumbers: true,
            bigNumberStrings: false,
        });
    }
    return _pool;
}

/** Jalankan query, kembalikan baris sebagai array. */
export async function query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
): Promise<T[]> {
    const [rows] = await db().query(sql, params);
    return rows as T[];
}

/** Jalankan query, kembalikan baris pertama atau null. */
export async function queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
): Promise<T | null> {
    const rows = await query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

/** Jalankan INSERT/UPDATE/DELETE, kembalikan info hasil. */
export async function execute(
    sql: string,
    params: unknown[] = [],
): Promise<mysql.ResultSetHeader> {
    const [res] = await db().query(sql, params);
    return res as mysql.ResultSetHeader;
}




/**
 * Jalankan sekumpulan operasi dalam satu transaksi.
 * Dipakai untuk penomoran dokumen yang butuh SELECT ... FOR UPDATE.
 */
export async function transaction<T>(
    fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
    const conn = await db().getConnection();
    try {
        await conn.beginTransaction();
        const hasil = await fn(conn);
        await conn.commit();
        return hasil;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

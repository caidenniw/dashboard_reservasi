/** Validasi tujuan redirect pasca-login (pengganti redirect()->intended()). */
export function nextPathAman(v: string | null | undefined): string {
    if (!v) {
        return "/";
    }
    // Hanya path internal: harus diawali "/" tapi bukan "//" (protocol-relative).
    if (!v.startsWith("/") || v.startsWith("//")) {
        return "/";
    }
    // Tolak backslash (beberapa peramban memperlakukannya sebagai "/").
    if (v.includes("\\")) {
        return "/";
    }
    return v;
}

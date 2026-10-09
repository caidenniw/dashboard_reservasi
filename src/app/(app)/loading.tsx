/*
 * Rangka muat untuk navigasi antar halaman di dalam shell; menjaga tata letak
 * agar perpindahan halaman tidak terasa seperti layar beku.
 */
export default function Memuat() {
    return (
        <div className="rangka-halaman" role="status">
            <span className="sr-only">Memuat halaman…</span>
            <div className="rangka judul" />
            <div className="rangka baris" />
            <div className="rangka baris" />
            <div className="rangka baris" />
            <div className="rangka baris" />
            <div className="rangka baris" />
            <div className="rangka baris" />
        </div>
    );
}

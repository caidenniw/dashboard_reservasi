/*
 * Skrip yang HARUS berjalan sebelum paint pertama (anti-FOUC), disalin dari
 * resources/views/layouts/app.blade.php. Digabung jadi satu agar sekali jalan.
 */
export const SKRIP_TEMA_AWAL = `
(function () {
    /* Pemulihan posisi scroll: sembunyikan dulu supaya tidak "flash ke atas". */
    try {
        if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
        if (sessionStorage.getItem('rn_scroll:' + location.pathname) !== null) {
            document.documentElement.classList.add('rn-restore');
            setTimeout(function () {
                document.documentElement.classList.remove('rn-restore');
            }, 1200);
        }
    } catch (e) {}

    /* Tema: pilihan tersimpan lebih dulu, kalau belum ada ikut pengaturan OS. */
    var t = 'light';
    try {
        t = localStorage.getItem('rn_theme') || '';
        if (t !== 'dark' && t !== 'light') {
            t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
    } catch (e) { t = 'light'; }
    document.documentElement.setAttribute('data-bs-theme', t);

    /* Sidebar lipat (desktop >=992px): pasang sebelum paint supaya tidak berkedip. */
    try {
        if (localStorage.getItem('rn_sidebar') === 'lipat') {
            document.documentElement.classList.add('sidebar-ciut');
        }
    } catch (e) {}
})();
`;

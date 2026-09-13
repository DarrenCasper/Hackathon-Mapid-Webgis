# TransitFit frontend

Frontend React/Vite dengan halaman hash Beranda (dummy), Map, Tempat, Insight, dan Lapor. Navigasi hash mendukung browser Back/Forward dan hosting statis tanpa rewrite route.

## Menjalankan lokal

1. Dari folder ini jalankan `npm ci`.
2. Salin `.env.example` ke `.env.local`.
3. Isi `VITE_API_BASE_URL` dengan URL backend berakhiran `/api`, dan `VITE_MAPID_API_KEY` dengan kunci basemap yang diizinkan untuk browser.
4. Jalankan `npm run dev`. Restart setelah perubahan environment.

Semua `VITE_*` terlihat oleh browser. Jangan masukkan rahasia server ke variabel ini.

## Backend untuk fitur baru

Backend publik lama belum otomatis memiliki perubahan lokal ini. Rute dan laporan bertitik perlu backend dari checkout yang sama:

- Konfigurasikan `DATABASE_URL`, `OVERPASS_URL`, dan `JWT_SECRET` pada `backend/.env`. Valhalla tetap digunakan untuk pembuatan isochrone yang sudah ada; pencarian rute sekarang dijalankan A* di browser.
- Dari folder backend: `npm ci`, kemudian `npx prisma migrate deploy`, lalu `npm start`. Migrasi harus dilakukan hanya pada database yang Anda miliki/diizinkan untuk diubah.
- Arahkan frontend ke backend tersebut dan atur `ALLOWED_ORIGIN` sesuai URL frontend.
- `GET /api/stations/:id/walking-graph` mengimpor graf OSM radius 2,2 km pada akses pertama, lalu menyimpan snapshot di database. Jalan dipisahkan berdasarkan node OSM asli, akses foot/private/barrier diperiksa, dan oneway:foot dihormati. Tidak menyambungkan jalan hanya karena garis berpotongan. Graf belum menangani seluruh aturan akses bersyarat; ruas dengan conditional access dikecualikan. Snapshot tidak diperbarui otomatis.
- A* berjalan dalam Web Worker dan dibatalkan saat tujuan berubah. Titik diproyeksikan ke ruas terdekat maksimal 75 m; jarak akses di luar graf ditampilkan terpisah. Jika terputus/terblokir, tampilkan kegagalan tanpa garis lurus pengganti.
- Biaya A*: panjang ruas × 1,12 untuk ruas biasa, × 1 untuk ruas rekomendasi terverifikasi, dan ruas blacklist dikeluarkan. Heuristik jarak geodesik tidak melebihi biaya tersebut. Rute terbaik berarti biaya terendah pada graf/bobot ini; bukan jaminan keselamatan. Waktu diperkirakan 4,5 km/jam, belum memperhitungkan tanjakan atau kecepatan pengguna.
- `GET /api/stations/:id/route-policy` hanya memuat laporan applied dengan bukti dan waktu verifikasi. Client mengecek ulang setiap 30 detik ketika aktif, saat fokus, atau melalui tombol hitung ulang. Kegagalan pengecekan menghilangkan rute lama.
- `GET /api/pois/:id` mendukung detail yang dibuka langsung lewat tautan.
- `GET /api/reports/capabilities` memeriksa kesiapan migrasi. Pengiriman lokasi tidak diaktifkan jika endpoint ini tidak siap.
- Laporan menyimpan longitude/latitude dan request_id unik. Foto opsional JPG/PNG/WebP maksimal 2 MB disimpan sebagai data URL dalam kolom photo_url di database; pertimbangkan object storage jika volume meningkat. Laporan tetap pending sampai dimoderasi.
- Draf laporan bertahan selama navigasi dalam tab, bukan setelah tab ditutup. Lokasi GPS diminta hanya ketika pengguna menekan tombol.

Data yang belum ada (alamat, foto tempat, daftar harga menu, pembayaran, jam ramai) ditampilkan sebagai belum tersedia. Statistik Insight mengikuti filter; narasi AI diberi label sebagai rangkuman kawasan keseluruhan.

## Feedback dan moderasi ruas

Dari hasil rute pilih Laporkan ruas buruk atau Rekomendasikan ruas, lalu pilih satu ruas, tandai titik, tulis kondisi/bukti, dan kirim. Metadata route_edge_ids, route_graph_version dan route_feedback disimpan pada laporan pending. Pin harus berada dalam 75 m dari ruas. Pending dan verified saja tidak mengubah kebijakan publik.

Admin membuka `#/admin` dengan akun moderator backend yang sudah ada. Pada laporan, periksa peta/foto dan bukti nyata, isi catatan pemeriksaan, lalu centang konfirmasi lapangan sebelum Setujui & terapkan. Sistem mencatat pernyataan admin; tidak otomatis membuktikan kebenaran kondisi fisik. Endpoint JWT `POST /api/admin/reports/:id/route-decision` menerima approve/reject/revoke. Approve menerapkan blacklist/rekomendasi secara transaksional bersama audit keputusan. Jalur verify lama tidak dapat digunakan untuk melewati aturan ini. Cabut keputusan membuka kembali ruas hanya jika tidak ada laporan aktif lain yang memblokirnya; blacklist selalu mengalahkan rekomendasi.

Migrasi tambahan: `20260912010000_browser_routing` setelah `20260911190000_report_location`. Deploy backend dan migrasi sebelum mengarahkan frontend baru ke API. Penyimpanan dan moderasi riil membutuhkan database; jangan menganggap tes fixture sebagai verifikasi deployment.

## Pemeriksaan

- `npm run build`
- `npm run lint`
- `npm run test:smoke`
- Backend: `node qa/features-smoke.cjs` (A*, graf OSM, kebijakan dan bukti moderasi, HTTP 401 serta validasi laporan; tidak menulis ke database).
- Browser alur rute/admin: `node qa/browser-routing-smoke.mjs <path-module-playwright> <folder-screenshot>` pada server QA port5174 yang sama. Memakai Worker asli dan fixture HTTP; mencakup pending tidak berpengaruh, approve reroute, revoke restore dan rekomendasi.
- Browser: jalankan Vite pada port 5174 dengan VITE_MAPID_API_KEY bernilai uji khusus, lalu `node qa/pages-smoke.mjs <path-module-playwright> <folder-screenshot>`. Tes mengintersepsi API dan basemap secara terisolasi, bukan mengirim laporan publik. Jangan gunakan kunci uji sebagai konfigurasi hosting.

Sebelum hosting GitHub Pages, atur Vite base sesuai subpath repository dan environment saat build; backend Express/Postgres/Valhalla harus di-host terpisah.

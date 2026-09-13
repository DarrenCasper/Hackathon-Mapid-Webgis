# TransitFit AI — Frontend Planning

> Dokumen ini adalah rencana frontend awal. Implementasi dan setup saat ini dijelaskan di [frontend/README.md](frontend/README.md): routing memakai A* browser, laporan memakai halaman dengan pin peta, dan navigasi mendukung beberapa halaman. Bagian ORS, fallback garis lurus, dan ReportModal di bawah tidak lagi berlaku untuk implementasi saat ini.

Companion untuk `build.md` (log backend) dan `guide.md` (kontrak API untuk
frontend, base URL `https://mapidapi.darrencasper.com/api`, sudah live).
Dokumen ini menerjemahkan brief desain dashboard (prompt UI/UX yang sudah
kamu tulis) menjadi rencana teknis yang **cocok dengan backend yang benar-
benar ada sekarang**, bukan dengan versi ideal di proposal PDF kompetisi.

Update dokumen ini per fase seperti `build.md` — catat apa yang selesai,
apa yang berubah, dan kenapa.

---

## 1. Reality Check: Proposal PDF vs Backend Aktual

Ini bagian paling penting untuk dibaca duluan. Proposal ("TransitFit AI"
PDF submission) menjanjikan beberapa hal yang **belum ada** di backend
yang sudah dibangun (`build.md` Phase 1–8). Kalau frontend langsung
dibangun mengikuti mockup Lampiran 2 tanpa mengecek ini, akan banyak UI
yang manggil endpoint yang tidak ada.

| Diklaim di proposal / mockup | Realita backend saat ini | Keputusan untuk frontend |
|---|---|---|
| Isochrone 5, 10, **dan** 15 menit | Hanya **10 dan 15** yang digenerate & divalidasi (`minutes` selain itu → 400). 5 menit masih "open item" di `build.md` Phase 3 | Slider/toggle waktu tempuh cuma 2 opsi: **10 min / 15 min**. Desain slider dari brief disederhanakan jadi segmented control 2 pilihan |
| Pemilihan **pintu keluar** (Utara/Selatan/Utama) per stasiun | `StationExit` model ada di schema tapi **selalu kosong** (`exits: []`) — tidak ada script yang mengisi data ini | Untuk MVP: exit selector **disembunyikan atau di-disable dengan label "Pintu Utama (default)"**, pakai `Station.location` sebagai titik tunggal. Jangan bangun UI yang butuh data yang tidak akan pernah datang sebelum ada keputusan project owner |
| Kisaran pengeluaran dari **Struk Go** (mis. "Rp18.000–28.000") | Data Struk Go di lapangan hasilnya sangat kecil/nyaris tidak ada — **keputusan tim: Struk Go tidak dipakai sama sekali**, bukan cuma "belum ada", memang di-drop dari scope. `Poi.price_tier` selalu `null` juga (tidak ada script yang pernah mengisinya) | Card tempat menampilkan **satu angka estimasi harga** dari `Poi.harga_rata_rata` ("≈ Rp15.000") atau "Data harga belum tersedia" kalau `null`. **Tidak ada rencana** tambah kolom harga min/max — jangan janjikan rentang harga di UI manapun |
| Rute jalan kaki digambar sebagai garis di peta + "Start Rute" | Tidak ada endpoint routing publik dari backend sendiri. Valhalla cuma reachable via Tailscale privat dari server backend, tidak bisa dipanggil langsung dari browser. Backend cuma expose **isochrone polygon**, bukan garis rute | Lihat §12 — solusi utama: panggil **OpenRouteService (ORS)** langsung dari frontend (foot-walking profile, gratis, CORS diizinkan, tidak butuh backend berubah). Garis lurus + Google Maps link jadi fallback kalau ORS gagal/limit habis |
| NLP search bar ("cari warung murah buka jam 7 pagi...") diproses AI | Tidak ada endpoint `/nlp/*` atau semacamnya. Satu-satunya AI di backend adalah `GET /stations/:id/insights` (teks statis ter-cache, di-generate harian, read-only) | MVP: parser NLP **sederhana di client** (regex/keyword matching → set filter terstruktur yang sudah ada: kategori, `minutes`, harga). Fase lanjutan: minta backend endpoint proxy ke Claude khusus untuk ini (jangan taruh Anthropic API key di frontend) |
| Mini chatbot interaktif per stasiun | Tidak ada endpoint chat/percakapan. Cuma insight statis | MVP: panel "AI Station Insight" menampilkan teks dari `/insights` apa adanya (dengan skeleton kalau `null`). Chatbot beneran = stretch goal, butuh endpoint backend baru |
| Badge "Tervalidasi Lapangan" vs "Data Terbuka" | **Ada** persis: `Poi.verified_field` (boolean) + `Poi.source` (`mapid_missions` / `openstreetmap` / `jakarta_opendata` / `mock`) | Bisa dibangun sesuai rencana, tidak ada gap. `verified_field === true` → badge emerald "Tervalidasi Lapangan"; selain itu → badge netral zinc dengan label sesuai `source` |
| Jam operasional per tempat | `Poi.jam_buka` / `Poi.jam_tutup` **bukan gap teknis** — `resolve-pois.js` sudah mencoba menarik `properties.jam_buka`/`jam_tutup` dari raw data misi MAPID (`menugo`) kalau field itu terisi. Masalahnya operasional: surveyor lapangan jarang mengisi field jam buka/tutup saat submit misi di MAPID Apps, jadi hasilnya sering `null` bukan karena pipeline tidak jalan | Tampilkan jam kalau ada, fallback "Jam operasional belum tercatat" kalau `null`. **Perbaikan sebenarnya bukan di kode** — lihat §12 poin operasional (instruksikan tim survei lapangan) dan poin teknis (endpoint `PATCH /admin/pois/:id` untuk backfill dari laporan terverifikasi) |
| Lapor kondisi jalur | `POST /reports` sudah live, publik, tanpa auth | Bisa dibangun 1:1 sesuai proposal, tidak ada gap |
| Peta pakai basemap MAPID | Sudah terverifikasi jalan (`build.md` Phase 4B, via Playwright) — style URL `https://v2.basemap.mapid.io/styles/street-v2.0/style.json?key=[MAPID_API_KEY]` | Langsung pakai, key sama dengan yang dipakai backend (`MAPID_API_KEY`) |

**Prinsip kerja:** setiap komponen di §9 ditandai `[REAL]` (data dari API
sungguhan), `[MOCK]` (dummy karena backend belum sediakan), atau
`[CLIENT-DERIVED]` (dihitung di frontend dari data real, misal jarak
meter dari koordinat). Jangan biarkan `[MOCK]` diam-diam berubah jadi
kelihatan seperti `[REAL]` di demo tanpa disclaimer kecil di UI atau
minimal dicatat di dokumen ini.

---

## 2. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Build tool | Vite + React (JS, bukan TS) | Tim (lihat Lampiran 1 assessment) semua jago ReactJS tapi tidak disebut TypeScript — jangan tambah friction belajar TS di tengah hackathon 5.5 minggu. Vite karena setup cepat, HMR instan untuk iterasi UI |
| Styling | Tailwind CSS | Sudah dipilih semua anggota tim di assessment |
| Peta | MapLibre GL JS (`react-map-gl` versi maplibre, atau native `maplibre-gl` + custom hook) | Backend basemap MAPID adalah MapLibre style JSON — bukan Mapbox. Jangan pakai `mapbox-gl` (lisensi + style tidak kompatibel penuh) |
| Data fetching + cache | TanStack Query (React Query) | Semua endpoint backend adalah REST read-mostly; React Query kasih caching, retry, loading/error state gratis tanpa nulis Redux boilerplate |
| State UI global (bukan server state) | Zustand | Ringan, cocok untuk state kecil: stasiun terpilih, filter, POI terpilih, chat open/close. Tidak perlu Redux untuk scope sekecil ini |
| HTTP client | `fetch` native dibungkus 1 file `lib/apiClient.js` | Tidak perlu axios untuk API sesederhana ini (semua GET + beberapa POST JSON) |
| Ikon | `lucide-react` | Ringan, konsisten dengan estetika "Modern Spatial Tech" |
| Font | Plus Jakarta Sans (Google Fonts) + fallback Inter | Sesuai brief desain |
| Deployment | Static build (`vite build`) di-serve lewat Nginx/Docker, sama pola self-hosted seperti backend (lihat `backend/README.md` Coolify section) | Konsisten dengan arsitektur di proposal (§5.1 PDF: self-hosting Cloudflare/Docker/Nginx) |

---

## 3. Struktur Folder

```
frontend/
  .env.example              # VITE_API_BASE_URL, VITE_MAPID_API_KEY
  index.html
  src/
    main.jsx
    App.jsx                 # layout shell 4-zona, routing kalau perlu (mungkin cukup 1 halaman + modal)
    lib/
      apiClient.js           # 1 fungsi fetch wrapper, base URL dari env, error handling terpusat
      geo.js                 # helper haversine distance, format meter/menit
      nlpParser.js            # parser keyword sederhana untuk search bar (lihat §11)
    api/                      # 1 file per resource, isinya React Query hooks
      useStations.js          # GET /stations, GET /regions/:region/stations
      useStation.js           # GET /stations/:id
      useIsochrone.js         # GET /stations/:id/isochrone
      usePois.js               # GET /stations/:id/pois
      useContext.js            # GET /stations/:id/context
      useInsight.js            # GET /stations/:id/insights
      useReports.js            # POST /reports
    store/
      useMapStore.js           # Zustand: selectedStationId, exitId(mock), minutes, filters, selectedPoiId, searchQuery
      useUiStore.js             # Zustand: sidebarOpen, chatOpen, reportModalOpen
    components/
      layout/
        Header.jsx
        BottomStatsBar.jsx
      header/
        StationSelector.jsx
        ExitSelector.jsx        # [MOCK] — lihat §1, render disabled/placeholder
        NlpSearchBar.jsx
      sidebar/
        FilterSidebar.jsx
        WalkTimeToggle.jsx      # 2 opsi: 10/15 menit
        CategoryFilter.jsx
        PriceFilter.jsx
        ValidationToggle.jsx    # filter verified_field
      map/
        MapCanvas.jsx           # MapLibre init + basemap MAPID
        IsochroneLayer.jsx
        PoiMarkers.jsx
        WalkingRouteLine.jsx    # [CLIENT-DERIVED/MOCK] garis lurus, lihat §12
        ExitMarker.jsx
      panel/
        RecommendationList.jsx
        RecommendationCard.jsx
        ValidationBadge.jsx
        StationInsightPanel.jsx  # [REAL] dari /insights
        MiniChatbot.jsx           # [MOCK] Phase-2 placeholder, lihat §11
      report/
        ReportModal.jsx
        ReportTypeSelect.jsx
      shared/
        Skeleton.jsx
        EmptyState.jsx
        ErrorState.jsx
    styles/
      index.css                # Tailwind entry + font import + CSS var tokens
  tailwind.config.js
  vite.config.js
```

---

## 4. Environment & Konfigurasi

```
VITE_API_BASE_URL=https://mapidapi.darrencasper.com/api
VITE_MAPID_API_KEY=<sama dengan backend punya>
VITE_ORS_API_KEY=<daftar gratis di openrouteservice.org, punya frontend sendiri>
```

Minta `VITE_MAPID_API_KEY` dari yang pegang `MAPID_API_KEY` di
`backend/.env` — jangan generate/tebak sendiri. Basemap style URL
dirakit di `MapCanvas.jsx`:
`https://v2.basemap.mapid.io/styles/street-v2.0/style.json?key=${import.meta.env.VITE_MAPID_API_KEY}`.

CORS: backend saat ini `ALLOWED_ORIGIN=*` (lihat `guide.md` bagian akhir).
Begitu frontend punya URL deploy, kabari tim backend supaya
`ALLOWED_ORIGIN` diset — dan pastikan `localhost` tetap diizinkan untuk
dev lokal setelah itu (lihat catatan di `guide.md`).

---

## 5. Data Layer — Mapping Hook ke Endpoint

| Hook | Endpoint | Dipakai di |
|---|---|---|
| `useStations()` | `GET /stations` | `StationSelector`, render semua marker stasiun di peta awal |
| `useStation(id)` | `GET /stations/:id` | Header info stasiun aktif, `exits` (selalu `[]`, jangan render array kosong sebagai error) |
| `useIsochrone(id, minutes)` | `GET /stations/:id/isochrone?minutes=` | `IsochroneLayer` |
| `usePois(id, minutes)` | `GET /stations/:id/pois?minutes=` | `PoiMarkers`, `RecommendationList` |
| `useContext(id, minutes)` | `GET /stations/:id/context?minutes=` | `BottomStatsBar`, ringkasan kategori dominan di `StationInsightPanel` header |
| `useInsight(id)` | `GET /stations/:id/insights` | `StationInsightPanel` — handle `insight: null` dengan skeleton, bukan spinner selamanya |
| `useSubmitReport()` | `POST /reports` | `ReportModal` |

Semua hook pakai `staleTime` cukup panjang (mis. 5 menit) — data ini
tidak berubah tiap detik, dan mengurangi refetch tiap kali user gonta-
ganti filter kategori (filter kategori/harga dilakukan **client-side**
dari hasil `usePois`, bukan query param baru ke server — backend tidak
punya filter kategori/harga di endpoint `/pois`).

`error.js` di `apiClient.js` harus membedakan: 404 (stasiun/isochrone
tidak ada → tampilkan `EmptyState`, bukan `ErrorState`) vs 400/500
(`ErrorState` beneran). Ini konsisten dengan konvensi error backend di
`guide.md`.

---

## 6. Global State (Zustand) — Bentuk Store

```js
// useMapStore.js
{
  selectedStationId: "jatinegara",
  selectedExitId: null,        // selalu null untuk sekarang, MOCK
  minutes: 10,                  // 10 | 15
  filters: {
    categories: [],              // subset dari 6 PoiCategory
    maxPrice: null,               // angka rupiah, filter client-side di harga_rata_rata
    onlyValidated: false,         // filter client-side di verified_field
  },
  selectedPoiId: null,
  searchQuery: "",
  setSelectedStation, setMinutes, setFilters, setSelectedPoi, setSearchQuery
}
```

```js
// useUiStore.js
{ sidebarOpen: true, chatOpen: false, reportModalOpen: false }
```

Kenapa dipisah dari React Query: server-state (`usePois`, dll) dan
UI-state (filter pilihan user) punya siklus hidup beda — cache server
data boleh stale 5 menit, tapi klik filter kategori harus instan re-
render list yang sudah ada di memori tanpa refetch.

---

## 7. Design System

| Token | Nilai | Pemakaian |
|---|---|---|
| `--color-base` | `#F8FAFC` (slate-50) | Background utama |
| `--color-surface` | `#FFFFFF` | Card, panel |
| `--color-accent` | `#4F46E5` (indigo-600) | CTA utama, active state, link |
| `--color-isochrone-10` | `#A855F7` (purple-500) | Layer isochrone 10 menit |
| `--color-isochrone-15` | `#3B82F6` (blue-500) | Layer isochrone 15 menit |
| `--color-validated` | `#10B981` (emerald-500) | Badge "Tervalidasi Lapangan" |
| `--color-muted-badge` | `#71717A` (zinc-500) | Badge "Data Terbuka"/sumber lain |
| Font display/body | Plus Jakarta Sans | Fallback: Inter, system-ui |
| Radius card | `rounded-2xl` (16px) | Semua card panel kanan |
| Shadow card | `shadow-sm` + border `border-slate-200` | Flat, bukan heavy drop-shadow — sesuai referensi Felt.com |

Isochrone 10 menit dirender dengan opacity lebih rendah dan area lebih
kecil **di atas** (bukan di bawah) layer 15 menit agar overlap-nya tidak
menghasilkan warna campuran yang salah baca — 15 menit sebagai layer
dasar, 10 menit sebagai layer atas dengan fill-opacity lebih pekat.

---

## 8. Layout 4-Zona → Komponen → Sumber Data

### Zona 1 — Header
| Elemen | Komponen | Sumber |
|---|---|---|
| Logo | statis | — |
| Selector stasiun | `StationSelector` | `[REAL]` `useStations()` |
| Selector pintu keluar | `ExitSelector` | `[MOCK]` — tampilkan 1 opsi "Pintu Utama", disabled/tooltip "Data pintu keluar granular belum tersedia" |
| NLP search bar | `NlpSearchBar` | `[CLIENT-DERIVED]` — lihat §11 |

### Zona 2 — Sidebar Kiri (Filter Spasial)
| Elemen | Komponen | Sumber |
|---|---|---|
| Toggle waktu tempuh | `WalkTimeToggle` | `[REAL]` tapi cuma 2 opsi (10/15), bukan slider 3 titik |
| Filter kategori kuliner | `CategoryFilter` | `[REAL]` — 6 nilai `PoiCategory` + "Belum dikategorikan" untuk `null` |
| Filter jam operasional | (opsional, taruh belakangan) | `[REAL, tapi data jarang terisi]` — beri disclaimer kalau hasil filter kosong karena `jam_buka` banyak `null`, bukan karena benar-benar tidak ada tempat buka |
| Toggle status validasi | `ValidationToggle` | `[REAL]` `verified_field` |

### Zona 3 — Peta (Canvas)
| Elemen | Komponen | Sumber |
|---|---|---|
| Basemap MAPID | `MapCanvas` | `[REAL]` |
| Layer isochrone | `IsochroneLayer` | `[REAL]` `useIsochrone` |
| Marker POI | `PoiMarkers` | `[REAL]` `usePois`, warna dot per kategori |
| Marker pintu keluar | `ExitMarker` | `[MOCK]` render di titik `Station.location` dengan label "Pintu Utama" |
| Garis rute jalan kaki | `WalkingRouteLine` | `[MOCK]` garis lurus putus-putus, lihat §12 |

### Zona 4 — Panel Kanan (Dual Card)
**Atas — daftar rekomendasi:**
`RecommendationList` → `RecommendationCard` per POI dari `usePois`,
diurutkan client-side: `verified_field` dulu, lalu jarak (haversine dari
`Station.location`/exit ke `Poi.location`, lihat `lib/geo.js`), lalu nama.
Card menampilkan:
- Nama, kategori (chip warna)
- **Estimasi waktu jalan** dihitung client-side dari jarak ÷ kecepatan
  jalan 4,5 km/jam (sesuai §3.3 PDF) — **bukan** waktu tempuh riil dari
  routing engine, karena tidak ada rute riil (lihat §12). Beri label kecil
  "estimasi lurus" bukan diklaim sebagai waktu tempuh aktual, supaya tidak
  menyesatkan padahal 15-menit isochrone sendiri sudah dihitung dari
  jaringan pedestrian riil oleh Valhalla di backend.
- `ValidationBadge` dari `verified_field` + `source`
- Harga: `harga_rata_rata` kalau ada, else "Data harga belum tersedia"
- "Alasan rekomendasi" singkat: string template client-side berbasis
  filter yang match (bukan generated AI per-card — tidak ada endpoint
  untuk itu), misal: "Sesuai kategori {kategori} dan tervalidasi lapangan"

**Bawah — AI Insight + Chatbot:**
`StationInsightPanel` → teks dari `useInsight`, dengan 3 state:
loading skeleton, `insight === null` → "Insight untuk stasiun ini belum
tersedia" + timestamp kosong, ada isi → render teks + `generated_at`
relative time. `MiniChatbot` = `[MOCK]` placeholder Phase 2 (lihat §11),
untuk MVP cukup tombol "Tanya AI (segera hadir)" disabled atau
menyembunyikan seluruhnya sampai backend endpoint chat tersedia.

### Bottom Bar
`BottomStatsBar` dari `useContext` (`poi_count`, kategori dominan) +
tombol CTA "Lapor Kondisi Jalur" buka `ReportModal` (`useSubmitReport`).

---

## 9. Fitur AI: Rencana Bertahap

**Search bar NLP** — MVP tidak memanggil LLM sama sekali:
1. `lib/nlpParser.js` cocokkan keyword sederhana dari input:
   - angka + "menit"/"min" → `minutes` (dibulatkan ke 10 atau 15 terdekat)
   - "murah"/"hemat" → `maxPrice` rendah (mis. 20000); "premium"/"mahal" → tinggi
   - nama kategori/sinonim ("kopi", "warung", "roti", dll) → `categories`
   - fallback: kalau tidak match apa-apa, treat sebagai pencarian nama POI biasa (filter `name` contains, case-insensitive)
2. Hasil parsing langsung set ke `useMapStore().filters` — tidak ada
   "AI" beneran di MVP, tapi UX-nya terasa seperti search pintar.
3. **Fase 2 (butuh backend baru):** ganti `nlpParser.js` dengan panggilan
   ke endpoint backend baru (mis. `POST /api/nlp/parse`) yang proxy ke
   Claude — jangan pernah taruh `ANTHROPIC_API_KEY` di kode frontend.

**Mini chatbot per stasiun** — MVP: tidak dibangun sebagai chat beneran.
Tampilkan `StationInsightPanel` saja (data real, cached, gratis dipanggil).
Fase 2: minta backend bikin endpoint chat baru yang grounded ke data POI
stasiun tsb (mirip prinsip `ai/station-insight-prompt.md` yang sudah ada
di backend) — sampai ada, `MiniChatbot.jsx` cukup jadi shell UI kosong
supaya gampang di-hook nanti tanpa refactor besar.

---

## 10. Rute Jalan Kaki di Peta — Gap Terbesar & Solusi

Backend **tidak** expose garis rute (hanya polygon isochrone dan titik
POI), dan Valhalla milik backend cuma reachable via Tailscale privat
(tidak bisa dipanggil langsung dari browser). Opsi yang dipertimbangkan:

1. ~~Panggil Valhalla backend langsung dari browser~~ — tidak bisa, bukan
   endpoint publik (lihat `backend/README.md`).
2. **Dipilih sebagai solusi utama MVP: OpenRouteService (ORS)**, dipanggil
   **langsung dari frontend**, profile `foot-walking`. Gratis (perlu daftar
   API key sendiri di openrouteservice.org, quota harian cukup untuk demo),
   CORS-nya mengizinkan pemanggilan dari browser, dan tidak butuh backend
   berubah sama sekali — bisa langsung dikerjakan tanpa nunggu tim backend.
   **Trade-off yang harus disadari:** ORS pakai data jalan sendiri (OSM,
   tapi engine beda dari Valhalla) — bentuk garis rute bisa sedikit tidak
   konsisten dengan tepi polygon isochrone yang dihitung Valhalla di
   backend. Untuk demo ini masih jauh lebih baik daripada garis lurus, tapi
   jangan kaget kalau di boundary isochrone ada sedikit selisih visual.
3. **Fallback kalau ORS gagal/limit habis/network error:** `WalkingRouteLine`
   turun ke garis lurus putus-putus (dashed) dari titik stasiun ke POI
   terpilih + label jarak garis lurus & estimasi waktu (lihat §8), plus
   tombol sekunder **"Buka arah jalan di Google Maps"**
   (`https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=walking`)
   untuk navigasi riil di HP user.
4. **Opsional/stretch, bukan lagi blocking:** minta tim backend bikin
   endpoint proxy `GET /api/stations/:id/route?to=<poi_id>&minutes=` ke
   Valhalla `/route` — kalau ada, rute jadi konsisten 100% dengan isochrone
   (satu mesin routing yang sama). Tidak wajib untuk MVP karena opsi ORS
   di atas sudah cukup jalan sendiri tanpa dependensi ke backend.

Implementasi: `lib/routing.js` baru berisi `fetchWalkingRoute(from, to)`
yang panggil ORS, dengan try/catch yang jatuh ke garis lurus di opsi 3
kalau request gagal — `WalkingRouteLine.jsx` tidak perlu tahu bedanya,
cukup terima array koordinat rute dari hook manapun sumbernya.

---

## 11. Roadmap Pengembangan Frontend

Selaras dengan rencana kerja 5,5 minggu di proposal (§5.2 PDF), tapi
dipecah versi frontend spesifik — jalan **paralel** dengan kerja backend
Phase 7/8 lanjutan yang masih ada open item.

| Minggu | Fokus | Output |
|---|---|---|
| 1 (0.5–1.5) | Setup Vite+Tailwind+MapLibre, `apiClient`, semua hook React Query, render peta kosong + basemap MAPID + 1 stasiun statis | Peta hidup, basemap MAPID kelihatan, data stasiun asli ke-fetch |
| 1.5–2.5 | `IsochroneLayer`, `PoiMarkers`, `StationSelector`, `WalkTimeToggle` (2 opsi) | Pilih stasiun → isochrone 10/15 & POI muncul akurat |
| 2.5–3.5 | `RecommendationList`/`Card`, `CategoryFilter`, `ValidationBadge`, `BottomStatsBar` (dari `/context`) | Panel kanan lengkap, filter kategori/validasi jalan client-side |
| 3.5–4 | `StationInsightPanel` (dari `/insights`), `ReportModal` (`POST /reports`), `WalkingRouteLine` versi garis lurus + link Google Maps | AI insight tampil (dengan handling `null`), lapor kondisi jalur berfungsi end-to-end |
| 4–4.5 | `NlpSearchBar` + `nlpParser.js`, responsive pass (mobile layout sesuai Lampiran 2.2), polish visual sesuai design tokens §7 | Search bar "AI-feel" jalan, tampilan mobile tidak rusak |
| 4.5–5 | Integrasi ulang kalau ada endpoint baru dari backend (routing/chat/NLP proxy), regression check semua state kosong/error/loading | Semua `[MOCK]` yang sudah bisa di-upgrade, ter-upgrade |
| 5–5.5 | Uji ke 5–8 pengguna, perbaikan, video demo, deploy build statis | MVP siap didemokan |

---

## 12. Permintaan ke Tim Backend (Open Asks)

Catat di sini, bukan cuma di chat, supaya tidak hilang. Dipisah teknis
(butuh kode backend) vs operasional (butuh keputusan/kerja non-kode).

**Teknis:**
1. Endpoint baru `PATCH /admin/pois/:id` (moderator-only, sama pola auth
   dengan `/admin/reports/:id/verify`) supaya field `jam_buka`,
   `jam_tutup`, `harga_rata_rata`, `kondisi_tempat` bisa di-backfill
   manual dari laporan pengguna yang sudah diverifikasi. Saat ini
   moderator bisa **verify laporan**, tapi tidak ada cara nulis hasilnya
   balik ke data POI — laporan terverifikasi jadi buntu, tidak pernah
   benar-benar "memperbarui data" seperti diklaim proposal §3.1.
2. Data `StationExit` riil (minimal 2–3 pintu untuk 3–5 stasiun pilot) —
   atau konfirmasi resmi kalau fitur pintu keluar di-drop dari MVP.
3. (Opsional/stretch, tidak blocking — lihat §10) endpoint proxy routing
   `GET /stations/:id/route?to=<poi_id>`, hanya kalau ada waktu lebih
   setelah fitur inti selesai, karena solusi ORS di §10 sudah jalan
   sendiri tanpa ini.
4. Konfirmasi `ALLOWED_ORIGIN` diupdate begitu frontend punya URL deploy
   (dan `localhost` tetap diizinkan untuk dev).

**Operasional (bukan kode, tapi harus dikoordinasikan):**
5. Saat survei lapangan tahap I & II (§5.2 proposal, minggu 1.5–3.5):
   pastikan surveyor **eksplisit mengisi field jam buka/tutup** di misi
   `menugo` MAPID Apps untuk setiap POI yang dikunjungi — pipeline
   (`resolve-pois.js`) sudah otomatis menariknya kalau field itu terisi,
   jadi ini murni soal kelengkapan input di lapangan, bukan menunggu
   perubahan kode.
6. Sudah diputuskan: **Struk Go tidak dipakai** (hasil data kecil) — tidak
   perlu tindak lanjut apa pun, cukup dikonfirmasi supaya tidak ada yang
   membangun fitur berbasis asumsi Struk Go masih relevan.
7. Kepastian scope NLP search & chatbot: apakah akan ada endpoint proxy AI
   baru sebelum deadline, atau MVP tetap client-side heuristic selamanya.

---

## 13. Non-Functional & Definition of Done MVP

- **Loading state**: skeleton card (bukan spinner polos) untuk
  `RecommendationList` dan `StationInsightPanel`.
- **Empty state**: stasiun dengan POI sedikit (contoh nyata: `cakung`
  cuma 1 POI di data awal, lihat `build.md` Phase 3) harus tetap terlihat
  rapi, bukan layout kosong aneh — pakai `EmptyState` dengan pesan jujur
  ("Cakupan data di sekitar stasiun ini masih terbatas"), sejalan dengan
  prinsip "data belum memadai" di §3.2 PDF, jangan tampil seolah sepi.
- **Error state**: 404 stasiun/isochrone → `EmptyState`, bukan crash;
  500/network error → `ErrorState` dengan tombol retry (React Query
  `refetch`).
- **Responsive**: breakpoint mobile mengikuti Lampiran 2.2 — panel kanan
  jadi bottom sheet, sidebar filter jadi drawer, peta full-bleed.
- **Performa peta**: 90 stasiun di `useStations()` — jangan render 90
  marker detail sekaligus di zoom rendah; cluster atau simplifikasi
  marker saat zoom < level tertentu.
- **DoD MVP**: user bisa pilih stasiun → lihat isochrone 10/15 menit
  asli → lihat daftar UMKM asli dengan badge validasi asli → baca AI
  insight asli (atau state kosong yang jujur) → filter kategori/harga
  client-side → kirim laporan kondisi jalur asli ke backend. Semua itu
  tanpa satupun data yang dipalsukan sebagai "real" padahal `[MOCK]`.

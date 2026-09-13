# TransitFit AI

**Langkah kecil. Temuan baru.**

TransitFit AI adalah WebGIS yang membantu penumpang KRL Commuter
Jabodetabek menemukan tempat makan, minum, dan hiburan **nyata** yang
benar-benar bisa dijangkau **dengan jalan kaki** dari stasiun tempat
mereka turun — bukan sekadar "dekat di peta", tapi dihitung dari waktu
tempuh jalan kaki yang sebenarnya (isochrone 10 & 15 menit).

## Latar Belakang

Turun dari KRL di stasiun yang asing itu sering bikin bingung: makan di
mana yang enak dan dekat? Google Maps bisa kasih tempat di sekitar, tapi
tidak menghitung apakah tempat itu benar-benar bisa dijangkau jalan kaki
dalam waktu wajar, dan tidak tahu kalau ada laporan warga soal jalur
yang rusak atau banjir. TransitFit AI dibangun untuk mengisi celah itu:
data POI (point of interest) yang nyata, dihitung dari jangkauan jalan
kaki yang nyata, plus AI yang menjelaskan area itu berdasarkan data
tersebut — bukan karangan.

## Fitur Utama

- **Peta interaktif per stasiun** — pilih salah satu dari 90 stasiun
  Jabodetabek, lihat area jangkauan 10 atau 15 menit jalan kaki dalam
  bentuk polygon (dihitung oleh Valhalla, mesin routing pejalan kaki),
  beserta seluruh tempat kuliner/hiburan di dalamnya.
- **Data tempat yang nyata**, bukan data buatan — digabungkan dari
  beberapa sumber terbuka: data misi & aktivitas MAPID, OpenStreetMap,
  data terbuka Pemprov DKI Jakarta (Satu Data Jakarta), dan Overture
  Maps Foundation. Setiap tempat diberi label sumber datanya secara
  jujur — tidak pernah disamarkan sebagai sumber lain.
- **Filter pencarian** — kategori (kopi & minuman, cepat saji, warung
  makan, bakery, casual dining, hiburan), anggaran, dan status
  "tervalidasi lapangan".
- **AI Station Insight** — ringkasan singkat per stasiun yang
  digenerate AI (Claude Haiku) berdasarkan data tempat yang benar-benar
  ada di sekitar stasiun tersebut, di-cache dan diperbarui otomatis
  setiap harinya kalau datanya berubah.
- **Chatbot AI per stasiun** — tanya jawab bebas seputar kawasan
  stasiun, termasuk laporan masalah yang **sudah diverifikasi
  moderator** (mis. banjir, akses tertutup) kalau memang ada. Dilengkapi
  penyaring (guard) untuk menolak pertanyaan di luar topik atau upaya
  penyalahgunaan sebelum sampai ke AI utama.
- **Rute jalan kaki di peta** — dihitung langsung di browser (algoritma
  A\*) dari graf jalan OpenStreetMap, otomatis menghindari ruas jalan
  yang sudah dikonfirmasi bermasalah lewat laporan warga.
- **Lapor kondisi jalur** — siapa saja bisa melaporkan trotoar rusak,
  akses tertutup, banjir, penyeberangan tidak aman, tempat tutup, atau
  info UMKM baru secara anonim, yang kemudian ditinjau moderator
  sebelum ditandai terverifikasi.

## Struktur Repo

```
Hackathon-Mapid/
├── backend/     API (Node.js/Express, PostgreSQL+PostGIS, Prisma) — lihat backend/README.md
├── frontend/    Aplikasi web (React + Vite) — lihat frontend/README.md
├── build.md     Catatan proses pengembangan backend, tahap demi tahap
├── guide.md     Referensi lengkap seluruh endpoint API
└── frontend.md  Catatan rencana & keputusan pengembangan frontend
```

## Teknologi

**Backend**
- Node.js + Express
- PostgreSQL + PostGIS (lewat Prisma)
- Valhalla — mesin routing untuk menghitung isochrone jalan kaki
- Anthropic Claude Haiku — AI insight & chatbot
- OpenAI (model kecil) — penyaring/guard sebelum chatbot utama dipanggil

**Frontend**
- React + Vite
- Tailwind CSS
- MapLibre GL (basemap dari MAPID)
- Zustand (state management) + TanStack Query (data fetching)

**Sumber data POI**: MAPID (misi & aktivitas kompetisi), OpenStreetMap,
Satu Data Jakarta, Overture Maps Foundation.

## Menjalankan Secara Lokal

Backend dan frontend adalah dua proyek Node.js terpisah, masing-masing
punya `package.json`, `.env.example`, dan README sendiri dengan
instruksi lengkap:

1. **Backend** — lihat [`backend/README.md`](backend/README.md)
2. **Frontend** — lihat [`frontend/README.md`](frontend/README.md)

Keduanya juga sudah punya `Dockerfile` masing-masing untuk deployment
(mis. lewat Coolify).

## Tim

| Nama | Peran |
|---|---|
| _Darren Dexter Thio_ | _Backend Developer + Self-Hosted Deployment_ |
| _Tyara Penelope Lumban Gaol_ | _Frontend Developer_ |
| _Ravelio Genesaret Simajuntak_ | _Frontend Developer_ |

---

Dibangun untuk kompetisi berbasis WebGIS menggunakan platform MAPID.

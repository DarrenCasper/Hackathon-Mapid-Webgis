import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Wallet, Coffee, Clock, Sparkles, ArrowUpRight, Footprints } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { useStation } from "../api/useStation";
import { usePois } from "../api/usePois";
import { useInsight } from "../api/useInsight";
import { api } from "../lib/apiClient";
import { applyFilters } from "../lib/poiFilters";
import { getCategoryMeta } from "../lib/constants";
import { formatRupiah } from "../lib/geo";
import { StationSelector } from "../components/header/StationSelector";
import { ExitSelector } from "../components/header/ExitSelector";
import { FilterSidebar } from "../components/sidebar/FilterSidebar";
import { NlpSearchBar } from "../components/header/NlpSearchBar";
import { RecommendationList } from "../components/panel/RecommendationList";
import { ReportPage } from "./ReportPage";
import { AdminRoutesPage } from "./AdminRoutesPage";

function SelectionPanel() {
  const [expanded, setExpanded] = useState(() => window.innerWidth > 760);
  return <aside className="selection-panel surface"><span className="eyebrow">AREA JELAJAHMU</span><StationSelector /><ExitSelector /><details className="selection-details" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}><summary>Sesuaikan pencarian & filter</summary><NlpSearchBar /><FilterSidebar /><p className="soft-note">Statistik mengikuti area, kategori, anggaran, dan pencarian yang kamu pilih.</p></details><a href="#/map" className="text-action">Kembali ke peta ↗</a></aside>;
}

function InsightPage() {
  const { selectedStationId, minutes, filters, searchQuery } = useMapStore();
  const { data: station } = useStation(selectedStationId);
  const query = usePois(selectedStationId, minutes);
  const narrative = useInsight(selectedStationId);
  const pois = applyFilters(query.data ?? [], filters, searchQuery);
  const prices = pois.map(p => p.harga_rata_rata).filter(p => Number.isFinite(p) && p >= 0).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length ? (prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2) : null;
  const counts = pois.reduce((acc, p) => ({ ...acc, [p.category ?? "uncategorized"]: (acc[p.category ?? "uncategorized"] ?? 0) + 1 }), {});
  const distribution = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const metrics = [
    [MapPin, "Pilihan di area ini", String(pois.length), "tempat sesuai filter"],
    [Wallet, "Median harga tercatat", median === null ? "Belum tersedia" : formatRupiah(median), `${prices.length} dari ${pois.length} tempat memiliki data harga`],
    [Coffee, "Kategori dominan", distribution.length ? getCategoryMeta(distribution[0][0]).label : "Belum tersedia", "berdasarkan tempat sesuai filter"],
    [Clock, "Jam paling ramai", "Belum tersedia", "Data kunjungan belum tersedia; bukan jam buka"]
  ];
  return <main className="workspace-page"><SelectionPanel /><section className="page-content">
    <span className="eyebrow">NEIGHBORHOOD INSIGHT</span><h1>Kawasan {station?.name ?? "pilihanmu"}</h1><p className="page-subtitle">Kenali sekitar stasiun dalam jangkauan {minutes} menit berjalan.</p>
    {!selectedStationId ? <div className="surface empty-panel">Pilih stasiun untuk mulai membaca kawasan.</div> : query.isPending ? <p role="status">Menghitung pilihan kawasan…</p> : query.error ? <div role="alert" className="surface">{query.error.message}<button onClick={() => query.refetch()}>Coba lagi</button></div> : <>
      <div className="narrative-card"><Sparkles size={28} /><div><h2>Sudut pandang kawasan</h2><p>{narrative.isPending ? "Memuat rangkuman…" : narrative.error ? "Rangkuman kawasan gagal dimuat." : narrative.data?.insight || "Rangkuman kawasan belum tersedia."}</p><small>Rangkuman AI kawasan keseluruhan; tidak mengikuti filter di halaman ini.</small>{narrative.error && <button onClick={() => narrative.refetch()}>Coba lagi</button>}</div></div>
      <div className="metric-grid">{metrics.map(([Icon, label, value, note], i) => <article className={`surface metric metric-${i}`} key={label}><span className="metric-icon"><Icon size={27} /></span><div><p>{label}</p><h2>{value}</h2><small>{note}</small></div></article>)}</div>
      <section className="surface category-distribution"><h2>Sebaran kategori</h2><p className="page-subtitle">Setiap tempat dihitung satu kali.</p>{!pois.length && <p>Tidak ada tempat sesuai filter ini. Sesuaikan pilihan di panel.</p>}{distribution.map(([category, count], i) => <div className="distribution-row" key={category}><div><strong>{getCategoryMeta(category).label}</strong><span>{count} tempat · {Math.round(count / pois.length * 100)}%</span></div><progress className={`bar-${i % 3}`} value={count} max={pois.length} aria-label={getCategoryMeta(category).label} /></div>)}</section>
      <p className="soft-note">Berdasarkan {pois.length} tempat sesuai filter. {narrative.data?.generated_at ? `Rangkuman AI diperbarui ${new Date(narrative.data.generated_at).toLocaleDateString("id-ID")}.` : "Tanggal pembaruan rangkuman belum tersedia."}</p></>}
  </section></main>;
}

function PlaceDetail({ id }) {
  const { selectedStationId, minutes, setSelectedPlace } = useMapStore();
  const nearby = usePois(selectedStationId, minutes);
  const known = nearby.data?.find(p => String(p.id) === id);
  const detail = useQuery({ queryKey: ["poi-detail", id], queryFn: () => api.get(`/pois/${encodeURIComponent(id)}`), enabled: !known && /^\d+$/.test(id), retry: 1 });
  const poi = known ?? detail.data;
  if (!/^\d+$/.test(id)) return <div className="surface">Tempat tidak ditemukan.</div>;
  if (!poi) return <div className="surface" role={detail.error ? "alert" : "status"}>{detail.error ? `Detail belum dapat dibuka: ${detail.error.message}` : "Memuat detail tempat…"}{detail.error && <button onClick={() => detail.refetch()}>Coba lagi</button>}</div>;
  const showMap = () => { setSelectedPlace(poi); window.location.hash = "/map"; };
  return <div className="place-detail-layout"><section className="surface detail-main"><span className="eyebrow">YOUR NEXT LITTLE DISCOVERY</span><h1>{poi.name}</h1><p className="page-subtitle">{getCategoryMeta(poi.category).label}</p><span className="verification-tag">{poi.verified_field ? "✓ Tervalidasi lapangan" : "Belum diverifikasi lapangan"}</span>
    <div className="metric-grid"><article className="metric metric-0"><Footprints /><div><p>Perjalanan kaki</p><h2>Lihat rute</h2><small>Jarak dan durasi dihitung dari stasiun pada peta.</small></div></article><article className="metric metric-1"><Wallet /><div><p>Harga rata-rata tercatat</p><h2>{formatRupiah(poi.harga_rata_rata)}</h2><small>Bukan harga seluruh menu.</small></div></article></div>
    <div className="detail-section"><Clock /><div><h2>Jam operasional</h2><p>{poi.jam_buka && poi.jam_tutup ? `${poi.jam_buka} – ${poi.jam_tutup}` : "Jam buka belum tersedia."}</p></div></div>
    <div className="detail-section"><Coffee /><div><h2>Menu utama</h2><p>{poi.menu_utama || "Menu belum tersedia untuk tempat ini."}</p><small>Daftar item dan harga per menu belum tersedia.</small></div></div>
    <div className="photo-empty"><Coffee size={42} /><p>Foto tempat belum tersedia</p><small>Kami tidak menggunakan foto ilustrasi sebagai foto tempat asli.</small></div>
  </section><aside className="surface detail-aside"><h2>Kenali tempatnya</h2><div className="detail-section"><MapPin /><div><h3>Lokasi</h3><p>{poi.location?.coordinates ? `${poi.location.coordinates[1].toFixed(5)}, ${poi.location.coordinates[0].toFixed(5)}` : "Koordinat belum tersedia"}</p><small>Alamat jalan belum tersedia.</small></div></div><h3>Pembayaran</h3><p>Belum tersedia.</p><h3>Suasana & highlight</h3><p>{poi.kondisi_tempat || "Informasi kondisi tempat belum tersedia."}</p><button className="primary-action" disabled={!selectedStationId} onClick={showMap}><Footprints size={18} /> Lihat rute</button><button className="secondary-action" onClick={showMap}>Lihat di peta <ArrowUpRight size={18} /></button>{!selectedStationId && <p>Pilih stasiun asal agar rute dapat dihitung.</p>}<a href="#/tempat" className="text-action">← Semua tempat</a></aside></div>;
}

export function ProjectPages({ page }) {
  if (page === "#/admin") return <AdminRoutesPage />;
  if (page === "#/insight") return <InsightPage />;
  if (page === "#/lapor") return <ReportPage />;
  if (page === "#/beranda") return <main className="home-page"><span className="eyebrow">TRANSITFIT AI · PRATINJAU BERANDA</span><h1>Turun di stasiun.<br /><em>Temukan sisi baru kota.</em></h1><p>Tempat menarik, langkah yang lebih terencana, dan cerita di setiap kawasan.</p><a className="primary-action" href="#/map">Mulai jelajah <ArrowUpRight size={20} /></a><div className="home-orb" aria-hidden="true" /><p className="soft-note">Beranda ini masih dummy. Jelajahi fitur aktif melalui Map, Tempat, dan Insight.</p></main>;
  if (page.startsWith("#/tempat")) return <main className="workspace-page"><SelectionPanel /><section className="page-content">{page.split("/")[2] ? <PlaceDetail key={page} id={page.split("/")[2]} /> : <><span className="eyebrow">SAVE YOUR NEXT STOP</span><h1>Tempat untuk disinggahi.</h1><p className="page-subtitle">Pilih detail tempat untuk melihat menu dan informasi yang tersedia.</p><div className="places-directory"><RecommendationList /></div></>}</section></main>;
  return <main className="page-content"><h1>Halaman tidak ditemukan</h1><a href="#/map">Kembali ke Map</a></main>;
}

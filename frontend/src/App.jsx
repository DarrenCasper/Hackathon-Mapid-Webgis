import { MiniChatbot } from "./components/panel/MiniChatbot";
import { useEffect, useState } from "react";
import "./styles/pages.css";
import "./styles/routing.css";
import { ProjectPages } from "./pages/ProjectPages";
import { Map, List, SlidersHorizontal, Footprints, Sparkles } from "lucide-react";
import { Header } from "./components/layout/Header";
import { BottomStatsBar } from "./components/layout/BottomStatsBar";
import { FilterSidebar } from "./components/sidebar/FilterSidebar";
import { MapSection } from "./components/map/MapSection";
import { RecommendationList } from "./components/panel/RecommendationList";
import { StationInsightPanel } from "./components/panel/StationInsightPanel";
import { StationSelector } from "./components/header/StationSelector";
import { ExitSelector } from "./components/header/ExitSelector";
import { NlpSearchBar } from "./components/header/NlpSearchBar";
import { useMapStore } from "./store/useMapStore";

export default function App() {
  const [page, setPage] = useState(window.location.hash);
  useEffect(() => {
    const change = () => setPage(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [mobileView, setMobileView] = useState("map");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const minutes = useMapStore((state) => state.minutes);
  const filters = useMapStore((state) => state.filters);
  const activeFilters = filters.categories.length + Number(filters.maxPrice !== null) + Number(filters.onlyValidated);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#explore">Lewati ke eksplorasi</a>
      <Header />
      {page.startsWith("#/") && page !== "#/map" ? <ProjectPages page={page} /> : <>
      <main id="explore" className="explorer" tabIndex={-1}>
        <section className="discovery-panel" aria-label="Pencarian dan filter">
          <div className="discovery-intro">
            <span className="eyebrow"><span/> YOUR NEXT STOP</span>
            <h1>Turun stasiun.<br/><em>Temukan keseruan.</em></h1>
            <p>Kopi favorit, makan enak, dan tempat baru.<br/>Semua dimulai dari satu langkah.</p>
            <span className="intro-orbit" aria-hidden="true"/>
          </div>
          <div className="exploration-controls">
            <div className="station-block"><label className="control-label" htmlFor="station-select">01 — Mulai dari mana?</label><StationSelector /><ExitSelector /></div>
            <NlpSearchBar />
            <button className="mobile-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="explore-filters"><SlidersHorizontal size={17}/> Sesuaikan pencarian {activeFilters > 0 && <span>{activeFilters}</span>}<span>{filtersOpen ? "Tutup" : "Filter"}</span></button>
            <div id="explore-filters" className={`filter-content ${filtersOpen ? "is-open" : ""}`}><FilterSidebar /></div>
            <div className="walking-note"><Footprints size={20}/><p><strong>Dekat di peta, belum tentu dekat di kaki.</strong>Rute berjalan dapat memutar. Periksa jalur sebelum berangkat.</p></div>
          </div>
        </section>
        <section className={`map-panel ${mobileView === "map" ? "mobile-active" : ""}`} aria-label="Peta tempat di sekitar stasiun">
          <div className="map-heading"><div><span className="eyebrow">EXPLORE THE NEIGHBORHOOD</span><h2>Satu stasiun, banyak cerita.</h2></div><span className="walk-chip"><Footprints size={15}/>{minutes} menit jalan</span></div>
          <div className="map-frame"><MapSection /></div>
          <div className="map-caption"><span className={`legend-dot minutes-${minutes}`}/><span>Area jangkauan {minutes} menit</span><span className="map-caption-end">Klik tempat untuk melihat rute</span></div>
        </section>
        <section className={`results-panel ${mobileView === "list" ? "mobile-active" : ""}`} aria-label="Daftar tempat">
          <div className="results-heading"><span className="eyebrow">PILIHAN DI SEKITARMU</span><h2>Mampir ke mana?</h2><p>Temukan yang pas untuk waktumu.</p></div>
          <div className="results-body"><RecommendationList /><div className="insight-wrap"><StationInsightPanel /><MiniChatbot /></div><div className="discovery-tip"><Sparkles size={17}/><p>Pilih kartu tempat untuk menyorot lokasinya di peta.</p></div></div>
        </section>
      </main>
      <nav className="mobile-view-switch" aria-label="Tampilan eksplorasi"><button aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}><Map size={18}/>Peta</button><button aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}><List size={18}/>Daftar tempat</button></nav>
      <BottomStatsBar />
      </>}
    </div>
  );
}

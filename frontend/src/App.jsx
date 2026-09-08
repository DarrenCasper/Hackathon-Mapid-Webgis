import { Header } from "./components/layout/Header";
import { BottomStatsBar } from "./components/layout/BottomStatsBar";
import { FilterSidebar } from "./components/sidebar/FilterSidebar";
import { MapSection } from "./components/map/MapSection";
import { RecommendationList } from "./components/panel/RecommendationList";
import { StationInsightPanel } from "./components/panel/StationInsightPanel";
import { MiniChatbot } from "./components/panel/MiniChatbot";
import { ReportModal } from "./components/report/ReportModal";

// Layout 4-zona sesuai frontend.md §8/§9: Header, Sidebar filter kiri,
// Canvas peta tengah, Panel kanan (dual card), Bottom stats bar.
export default function App() {
  return (
    <div className="flex h-screen flex-col bg-canvas">
      <Header />

      <div className="flex min-h-0 flex-1">
        <FilterSidebar />

        <main className="min-w-0 flex-1">
          <MapSection />
        </main>

        <aside className="flex min-h-0 w-80 shrink-0 flex-col gap-3 border-l border-slate-200 bg-canvas p-3">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RecommendationList />
          </div>
          <div className="shrink-0 space-y-2">
            <StationInsightPanel />
            <MiniChatbot />
          </div>
        </aside>
      </div>

      <BottomStatsBar />
      <ReportModal />
    </div>
  );
}

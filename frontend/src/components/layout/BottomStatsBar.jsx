import { AlertCircle, Flag } from "lucide-react";
import { useMapStore } from "../../store/useMapStore";
import { useUiStore } from "../../store/useUiStore";
import { useStationContext } from "../../api/useContext";
import { getCategoryMeta } from "../../lib/constants";

function dominantCategory(counts) {
  const entries = Object.entries(counts ?? {}).filter(([k]) => k !== "uncategorized");
  if (entries.length === 0) return null;
  const [category, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return count > 0 ? category : null;
}

export function BottomStatsBar() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const minutes = useMapStore((s) => s.minutes);
  const setReportModalOpen = useUiStore((s) => s.setReportModalOpen);
  const { data: context } = useStationContext(selectedStationId, minutes);

  const dominant = dominantCategory(context?.poi_count_by_category);
  const dominantMeta = dominant ? getCategoryMeta(dominant) : null;

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-4">
      <div className="flex items-center gap-4 text-xs text-slate-600">
        {context ? (
          <>
            <span>
              <strong className="text-slate-800">{context.poi_count}</strong> tempat kuliner
            </span>
            {dominantMeta && (
              <span className="flex items-center gap-1">
                Kategori dominan:
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: dominantMeta.color }}
                >
                  {dominantMeta.label}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Pilih stasiun untuk melihat statistik kontribusi data
          </span>
        )}
      </div>

      <button
        onClick={() => setReportModalOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
      >
        <Flag className="h-3.5 w-3.5" />
        Lapor Kondisi Jalur
      </button>
    </footer>
  );
}

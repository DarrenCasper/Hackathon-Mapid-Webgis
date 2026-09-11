import { Sparkles } from "lucide-react";
import { useMapStore } from "../../store/useMapStore";
import { useInsight } from "../../api/useInsight";
import { Skeleton } from "../shared/Skeleton";

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "baru saja diperbarui";
  if (hours < 24) return `diperbarui ${hours} jam lalu`;
  return `diperbarui ${Math.floor(hours / 24)} hari lalu`;
}

// Teks dari GET /stations/:id/insights — cached, bukan live. `insight`
// bisa null (belum pernah digenerate) — state normal, bukan error. Lihat
// guide.md "About the AI insight feature" & frontend.md §9.
export function StationInsightPanel() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const { data, isLoading } = useInsight(selectedStationId);

  if (!selectedStationId) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        AI Station Insight
      </div>

      {isLoading && (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}

      {!isLoading && data && !data.insight && (
        <p className="text-sm text-slate-500">
          Insight untuk stasiun ini belum tersedia — akan digenerate otomatis pada siklus pembaruan berikutnya.
        </p>
      )}

      {!isLoading && data?.insight && (
        <>
          <p className="text-sm leading-relaxed text-slate-700">{data.insight}</p>
          <p className="mt-2 text-[11px] text-slate-400">{timeAgo(data.generated_at)}</p>
        </>
      )}
    </div>
  );
}

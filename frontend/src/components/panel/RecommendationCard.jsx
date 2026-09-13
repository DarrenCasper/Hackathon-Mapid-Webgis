import { getCategoryMeta } from "../../lib/constants";
import { distanceMeters, estimateWalkMinutes, formatMeters, formatRupiah } from "../../lib/geo";
import { ValidationBadge } from "./ValidationBadge";
import { useMapStore } from "../../store/useMapStore";

// Alasan rekomendasi = template string client-side berbasis filter yang
// match, BUKAN teks dari AI per-card (tidak ada endpoint untuk itu).
// Lihat frontend.md §8.
function buildReason(poi, filters) {
  const reasons = [];
  if (poi.verified_field) reasons.push("tervalidasi lapangan");
  if (filters.categories.includes(poi.category)) {
    reasons.push(`sesuai kategori ${getCategoryMeta(poi.category).label.toLowerCase()}`);
  }
  if (filters.maxPrice && poi.harga_rata_rata != null && poi.harga_rata_rata <= filters.maxPrice) {
    reasons.push("sesuai anggaran");
  }
  if (reasons.length === 0) reasons.push("berada dalam jangkauan berjalan kaki terpilih");
  return reasons.join(" · ");
}

export function RecommendationCard({ poi, stationCoordinates }) {
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);
  const setSelectedPoi = useMapStore((s) => s.setSelectedPoi);
  const filters = useMapStore((s) => s.filters);

  const meta = getCategoryMeta(poi.category);
  const meters = stationCoordinates ? distanceMeters(stationCoordinates, poi.location.coordinates) : null;
  const walkMinutes = meters != null ? estimateWalkMinutes(meters) : null;
  const isSelected = poi.id === selectedPoiId;

  return (
    <button
      onClick={() => setSelectedPoi(poi.id)}
      className={`w-full rounded-2xl border p-3 text-left transition ${
        isSelected
          ? "border-accent bg-accent/5"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{poi.name}</p>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        {walkMinutes != null && (
          <div className="text-right">
            <p className="text-sm font-bold text-accent">{walkMinutes} min walk</p>
            <p className="text-[11px] text-slate-400">
              {formatMeters(meters)} · estimasi lurus
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <ValidationBadge verifiedField={poi.verified_field} source={poi.source} />
        <span className="text-xs font-medium text-slate-600">{formatRupiah(poi.harga_rata_rata)}</span>
      </div>

      <p className="mt-2 text-xs text-slate-500">{buildReason(poi, filters)}</p>
    </button>
  );
}

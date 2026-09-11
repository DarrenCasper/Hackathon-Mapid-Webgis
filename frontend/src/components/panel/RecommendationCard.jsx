import { getCategoryMeta } from "../../lib/constants";
import { distanceMeters, estimateWalkMinutes, formatMeters, formatRupiah } from "../../lib/geo";
import { ValidationBadge } from "./ValidationBadge";
import { useMapStore } from "../../store/useMapStore";
import { Coffee, Utensils, Croissant, ArrowUpRight, Footprints } from "lucide-react";

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
  const CategoryIcon = poi.category === "kopi_minuman" ? Coffee : poi.category === "bakery" ? Croissant : Utensils;

  return (
    <button
      onClick={() => setSelectedPoi(poi.id)}
      aria-pressed={isSelected}
      className={`place-card ${isSelected ? "is-selected" : ""}`}
    >
      <div className="place-card-top"><span className="place-icon"><CategoryIcon size={21}/></span><span className="place-category">{meta.label}</span><ArrowUpRight size={17}/></div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{poi.name}</p>
        </div>
        {walkMinutes != null && (
          <div className="text-right">
            <p className="place-walk"><Footprints size={13}/>{walkMinutes} menit</p>
            <p className="text-[11px] text-slate-400">
              {formatMeters(meters)} · estimasi lurus
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <ValidationBadge verifiedField={poi.verified_field} source={poi.source} />
        <span className="place-price">{formatRupiah(poi.harga_rata_rata)}</span>
      </div>

      <p className="mt-2 text-xs text-slate-500">{buildReason(poi, filters)}</p>
      {isSelected && <span className="selected-place-label">Dipilih · lokasi ditandai di peta</span>}
    </button>
  );
}

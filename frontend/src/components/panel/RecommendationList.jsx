import { useMemo } from "react";
import { useMapStore } from "../../store/useMapStore";
import { useStation } from "../../api/useStation";
import { usePois } from "../../api/usePois";
import { ApiError } from "../../lib/apiClient";
import { sortPois } from "../../lib/poiSort";
import { ArrowUpDown, MapPin } from "lucide-react";
import { RecommendationCard } from "./RecommendationCard";
import { RecommendationCardSkeleton } from "../shared/Skeleton";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { applyFilters } from "../../lib/poiFilters";

// Semua filter (kategori, harga, validasi, search) diterapkan CLIENT-SIDE
// dari satu hasil usePois — backend tidak punya query param untuk ini.
// Lihat frontend.md §5.

export function RecommendationList() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const minutes = useMapStore((s) => s.minutes);
  const filters = useMapStore((s) => s.filters);
  const searchQuery = useMapStore((s) => s.searchQuery);
  const sortBy = useMapStore((s) => s.sortBy);
  const setSortBy = useMapStore((s) => s.setSortBy);

  const { data: station } = useStation(selectedStationId);
  const { data: pois, isLoading, isError, error, refetch } = usePois(selectedStationId, minutes);

  const stationCoordinates = station?.location?.coordinates;

  const sortedPois = useMemo(() => {
    if (!pois) return [];
    const filtered = applyFilters(pois, filters, searchQuery);
    return sortPois(filtered, sortBy, stationCoordinates);
  }, [pois, filters, searchQuery, stationCoordinates, sortBy]);

  if (!selectedStationId) {
    return <EmptyState title="Pilih stasiun untuk melihat rekomendasi kuliner" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <RecommendationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          title="Belum ada isochrone untuk stasiun ini"
          description="Coba pilih waktu tempuh lain atau stasiun lain."
        />
      );
    }
    return <ErrorState message="Gagal memuat daftar rekomendasi" onRetry={refetch} />;
  }

  if (sortedPois.length === 0) {
    return (
      <EmptyState
        title="Data belum memadai"
        description="Cakupan data UMKM di sekitar stasiun/filter ini masih terbatas — bukan berarti benar-benar sepi."
      />
    );
  }

  return (
    <div className="recommendations">
      <div className="results-summary" aria-live="polite">
        <MapPin size={20} /><div><strong>{sortedPois.length} tempat ditemukan</strong><p>Dalam jangkauan {minutes} menit</p></div>
      </div>
      <label className="sort-control"><ArrowUpDown size={16} /><span>Urutkan</span>
        <select aria-label="Urutkan tempat" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="recommended">Rekomendasi</option>
          <option value="distance">Jarak terdekat</option>
          <option value="price-asc">Harga termurah</option>
          <option value="price-desc">Harga termahal</option>
        </select>
      </label>
      {(sortBy === "price-asc" || sortBy === "price-desc") && <p className="sort-hint">Berdasarkan harga rata-rata. Harga belum tersedia ditampilkan terakhir.</p>}
      {(sortBy === "price-asc" || sortBy === "price-desc") && sortedPois.every((poi) => poi.harga_rata_rata == null) && <p role="status" className="price-data-notice">Harga tempat di area ini belum tersedia. Untuk sementara, tempat diurutkan menurut jarak.</p>}
      <div className="place-list">{sortedPois.map((poi) => (
        <RecommendationCard key={poi.id} poi={poi} stationCoordinates={stationCoordinates} />
      ))}</div>
    </div>
  );
}

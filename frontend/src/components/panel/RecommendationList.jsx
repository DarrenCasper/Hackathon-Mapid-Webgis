import { useMemo } from "react";
import { useMapStore } from "../../store/useMapStore";
import { useStation } from "../../api/useStation";
import { usePois } from "../../api/usePois";
import { ApiError } from "../../lib/apiClient";
import { distanceMeters } from "../../lib/geo";
import { RecommendationCard } from "./RecommendationCard";
import { RecommendationCardSkeleton } from "../shared/Skeleton";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";

// Semua filter (kategori, harga, validasi, search) diterapkan CLIENT-SIDE
// dari satu hasil usePois — backend tidak punya query param untuk ini.
// Lihat frontend.md §5.
function applyFilters(pois, filters, searchQuery) {
  return pois.filter((poi) => {
    if (filters.onlyValidated && !poi.verified_field) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(poi.category)) return false;
    if (filters.maxPrice != null) {
      if (poi.harga_rata_rata == null || poi.harga_rata_rata > filters.maxPrice) return false;
    }
    if (searchQuery && !poi.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      // hanya jadi hard-filter kalau tidak ada filter terstruktur lain yang match
      const hasStructuredMatch =
        filters.categories.includes(poi.category) || (filters.maxPrice != null && poi.harga_rata_rata != null);
      if (!hasStructuredMatch) return false;
    }
    return true;
  });
}

export function RecommendationList() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const minutes = useMapStore((s) => s.minutes);
  const filters = useMapStore((s) => s.filters);
  const searchQuery = useMapStore((s) => s.searchQuery);

  const { data: station } = useStation(selectedStationId);
  const { data: pois, isLoading, isError, error, refetch } = usePois(selectedStationId, minutes);

  const stationCoordinates = station?.location?.coordinates;

  const sortedPois = useMemo(() => {
    if (!pois) return [];
    const filtered = applyFilters(pois, filters, searchQuery);
    return [...filtered].sort((a, b) => {
      if (a.verified_field !== b.verified_field) return a.verified_field ? -1 : 1;
      if (stationCoordinates) {
        const da = distanceMeters(stationCoordinates, a.location.coordinates);
        const db = distanceMeters(stationCoordinates, b.location.coordinates);
        if (da !== db) return da - db;
      }
      return a.name.localeCompare(b.name);
    });
  }, [pois, filters, searchQuery, stationCoordinates]);

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
    <div className="space-y-2">
      {sortedPois.map((poi) => (
        <RecommendationCard key={poi.id} poi={poi} stationCoordinates={stationCoordinates} />
      ))}
    </div>
  );
}

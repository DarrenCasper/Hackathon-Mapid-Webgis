import { useMapStore } from "../../store/useMapStore";
import { useStation } from "../../api/useStation";
import { useIsochrone } from "../../api/useIsochrone";
import { usePois } from "../../api/usePois";
import { MapCanvas } from "./MapCanvas";
import { IsochroneLayer } from "./IsochroneLayer";
import { PoiMarkers } from "./PoiMarkers";
import { ExitMarker } from "./ExitMarker";
import { WalkingRouteLine } from "./WalkingRouteLine";
import { useMemo } from "react";
import { applyFilters } from "../../lib/poiFilters";

export function MapSection() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const minutes = useMapStore((s) => s.minutes);
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);
  const selectedPoiData = useMapStore((s) => s.selectedPoiData);
  const selectedExitId = useMapStore((s) => s.selectedExitId);
  const filters = useMapStore((s) => s.filters);
  const searchQuery = useMapStore((s) => s.searchQuery);

  const { data: station } = useStation(selectedStationId);
  const { data: isochrone, error: isochroneError } = useIsochrone(selectedStationId, minutes);
  const { data: pois } = usePois(selectedStationId, minutes);

  const visiblePois = useMemo(() => applyFilters(pois ?? [], filters, searchQuery), [pois, filters, searchQuery]);
  const selectedPoi = visiblePois.find((p) => p.id === selectedPoiId) ?? (selectedPoiData?.id === selectedPoiId ? selectedPoiData : null);
  const origin = station?.exits?.find(e => e.id === selectedExitId)?.location?.coordinates ?? station?.location?.coordinates;
  const markerPois = selectedPoi && !visiblePois.some(p => p.id === selectedPoi.id) ? [...visiblePois,selectedPoi] : visiblePois;

  return (
    <MapCanvas>
      {station?.location?.coordinates && (
        <ExitMarker coordinates={origin} />
      )}
      {isochrone?.polygon && <IsochroneLayer polygon={isochrone.polygon} minutes={minutes} />}
      <PoiMarkers pois={markerPois} />
      {isochroneError && (
        <div role="alert" className="absolute bottom-3 left-3 right-3 rounded-lg bg-white p-3 text-sm text-red-700 shadow">
          {isochroneError.status === 404 ? "Data jangkauan berjalan belum tersedia untuk pilihan ini." : "Gagal memuat jangkauan berjalan dari backend."}
        </div>
      )}
      {station?.location?.coordinates && selectedPoi?.location?.coordinates && (
        <WalkingRouteLine
          from={origin}
          to={selectedPoi.location.coordinates}
        />
      )}
      {!selectedStationId && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto rounded-2xl bg-white/95 px-5 py-3 text-sm font-medium text-slate-600 shadow">
            Pilih stasiun di atas untuk mulai menjelajah
          </div>
        </div>
      )}
    </MapCanvas>
  );
}

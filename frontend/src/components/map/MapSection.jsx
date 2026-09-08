import { useMapStore } from "../../store/useMapStore";
import { useStation } from "../../api/useStation";
import { useIsochrone } from "../../api/useIsochrone";
import { usePois } from "../../api/usePois";
import { MapCanvas } from "./MapCanvas";
import { IsochroneLayer } from "./IsochroneLayer";
import { PoiMarkers } from "./PoiMarkers";
import { ExitMarker } from "./ExitMarker";
import { WalkingRouteLine } from "./WalkingRouteLine";

export function MapSection() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const minutes = useMapStore((s) => s.minutes);
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);

  const { data: station } = useStation(selectedStationId);
  const { data: isochrone } = useIsochrone(selectedStationId, minutes);
  const { data: pois } = usePois(selectedStationId, minutes);

  const selectedPoi = pois?.find((p) => p.id === selectedPoiId);

  return (
    <MapCanvas>
      {isochrone?.polygon && <IsochroneLayer polygon={isochrone.polygon} minutes={minutes} />}
      {pois && <PoiMarkers pois={pois} />}
      {station?.location?.coordinates && (
        <ExitMarker coordinates={station.location.coordinates} />
      )}
      {station?.location?.coordinates && selectedPoi?.location?.coordinates && (
        <WalkingRouteLine
          from={station.location.coordinates}
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

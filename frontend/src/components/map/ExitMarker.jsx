import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { useMap } from "./MapContext";

// [MOCK] Selalu render di titik Station.location, bukan pintu keluar
// granular — lihat frontend.md §1, StationExit belum pernah diisi backend.
export function ExitMarker({ coordinates }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !coordinates) return;

    const el = document.createElement("div");
    el.className =
      "flex h-8 w-8 items-center justify-center rounded-full bg-accent text-base shadow-lg border-2 border-white";
    el.textContent = "🚉";

    const marker = new Marker({ element: el }).setLngLat(coordinates).addTo(map);
    markerRef.current = marker;
    map.flyTo({ center: coordinates, zoom: 14, duration: 500 });

    return () => marker.remove();
  }, [map, coordinates]);

  return null;
}

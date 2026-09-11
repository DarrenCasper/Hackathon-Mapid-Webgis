import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { useMap } from "./MapContext";
import { getCategoryMeta } from "../../lib/constants";
import { useMapStore } from "../../store/useMapStore";

export function PoiMarkers({ pois }) {
  const map = useMap();
  const markersRef = useRef([]);
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);
  const setSelectedPoi = useMapStore((s) => s.setSelectedPoi);

  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const poi of pois ?? []) {
      const meta = getCategoryMeta(poi.category);
      const isSelected = poi.id === selectedPoiId;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", poi.name);
      el.className = "poi-marker";
      el.setAttribute("aria-pressed", String(isSelected));
      el.style.setProperty("--marker-color", meta.color);
      el.addEventListener("click", () => setSelectedPoi(poi.id));

      const marker = new Marker({ element: el })
        .setLngLat(poi.location.coordinates)
        .addTo(map);
      markersRef.current.push(marker);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, pois, selectedPoiId, setSelectedPoi]);

  return null;
}

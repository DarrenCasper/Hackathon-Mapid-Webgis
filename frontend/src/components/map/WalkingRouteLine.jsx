import { useEffect, useState } from "react";
import { useMap } from "./MapContext";
import { fetchWalkingRoute } from "../../lib/routing";

const SOURCE_ID = "walking-route-source";
const LAYER_ID = "walking-route-line";

// Garis rute jalan kaki dari titik stasiun ke POI terpilih. Lihat
// frontend.md §10: ORS jadi sumber utama, garis lurus putus-putus jadi
// fallback jujur (ditandai lewat badge kecil) kalau ORS gagal.
export function WalkingRouteLine({ from, to }) {
  const map = useMap();
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (!map) return;

    if (!from || !to) {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    fetchWalkingRoute(from, to).then((result) => {
      if (cancelled) return;
      setIsFallback(result.isFallback);

      const geojson = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: result.coordinates },
        properties: {},
      };

      if (map.getSource(SOURCE_ID)) {
        map.getSource(SOURCE_ID).setData(geojson);
        map.setPaintProperty(LAYER_ID, "line-dasharray", result.isFallback ? [2, 2] : [1, 0]);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#4F46E5",
            "line-width": 3.5,
            "line-dasharray": result.isFallback ? [2, 2] : [1, 0],
          },
        });
      }
    });

    return () => {
      cancelled = true;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, from, to]);

  if (!isFallback || !from || !to) return null;

  return (
    <div className="absolute bottom-3 left-3 max-w-xs rounded-lg bg-white/95 px-2.5 py-1.5 text-xs text-slate-600 shadow">
      Rute estimasi (garis lurus) — layanan rute detail sedang tidak tersedia
    </div>
  );
}

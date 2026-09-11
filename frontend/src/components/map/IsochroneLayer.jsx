import { useEffect } from "react";
import { useMap } from "./MapContext";
import { polygonBounds } from "../../lib/geo";

const SOURCE_ID = "isochrone-source";
const FILL_LAYER_ID = "isochrone-fill";
const LINE_LAYER_ID = "isochrone-line";

// Warna sesuai token desain frontend.md §7 — 15 menit di bawah (area lebih
// besar), 10 menit ditumpuk di atas dengan opacity lebih pekat, supaya
// overlap dua polygon tidak menghasilkan warna campuran yang salah baca.
const COLORS = { 10: "#A855F7", 15: "#3B82F6" };

export function IsochroneLayer({ polygon, minutes }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !polygon) return;

    const geojson = { type: "Feature", geometry: polygon, properties: {} };
    const color = COLORS[minutes] ?? COLORS[10];

    if (map.getSource(SOURCE_ID)) {
      map.getSource(SOURCE_ID).setData(geojson);
      map.setPaintProperty(FILL_LAYER_ID, "fill-color", color);
      map.setPaintProperty(LINE_LAYER_ID, "line-color", color);
    } else {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": color, "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": color, "line-width": 2 },
      });
    }

    // maxZoom dibatasi 16: source vector tile MAPID untuk Indonesia
    // (`indonesia.json`) melaporkan maxzoom 14, dan render-nya benar-benar
    // berhenti (blank, bukan sekadar blocky/overzoom) di zoom yang lebih
    // tinggi lagi. Isochrone 10 menit itu areanya kecil, jadi tanpa cap
    // ini fitBounds akan zoom jauh melewati batas tersebut. Ditemukan
    // lewat pengetesan manual (klik zoom-out memunculkan basemap lagi).
    map.fitBounds(polygonBounds(polygon), { padding: 80, duration: 500, maxZoom: 16 });
    const refit = () => map.fitBounds(polygonBounds(polygon), { padding: 40, duration: 0, maxZoom: 16 });
    map.on("resize", refit);
    return () => {
      map.off("resize", refit);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, polygon, minutes]);

  return null;
}

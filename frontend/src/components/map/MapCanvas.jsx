import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { MapContext } from "./MapContext";

// Basemap MAPID (MapLibre style JSON) — key sama dengan yang dipakai
// backend (MAPID_API_KEY), sudah terverifikasi jalan di build.md Phase 4B.
const MAPID_STYLE_URL = `https://v2.basemap.mapid.io/styles/street-v2.0/style.json?key=${
  import.meta.env.VITE_MAPID_API_KEY
}`;

const JAKARTA_CENTER = [106.8456, -6.2088];

export function MapCanvas({ children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAPID_STYLE_URL,
      center: JAKARTA_CENTER,
      zoom: 11,
    });
    map.addControl(new NavigationControl(), "top-right");

    // MapLibre menghitung ukuran canvas dari getBoundingClientRect() saat
    // instance dibuat. Kalau container belum selesai di-layout React
    // (mis. race dengan flex parent, atau double-invoke efek di
    // StrictMode saat dev), canvas bisa "kekunci" di ukuran 0 dan peta
    // tampak blank meski style/tile sukses di-fetch (lihat error handler
    // di bawah untuk membedakan dari kegagalan fetch/WebGL beneran).
    // ResizeObserver ini memaksa map.resize() setiap kali ukuran
    // container benar-benar berubah, termasuk begitu layout final settle.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.on("load", () => {
      map.resize();
      setMapInstance(map);
    });
    map.on("error", (e) => {
      console.error("[MapCanvas] MapLibre error:", e.error ?? e);
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  return (
    <div className="relative h-full w-full bg-slate-100">
      <div ref={containerRef} className="h-full w-full" />
      <MapContext.Provider value={mapInstance}>
        {mapInstance ? children : null}
      </MapContext.Provider>
    </div>
  );
}

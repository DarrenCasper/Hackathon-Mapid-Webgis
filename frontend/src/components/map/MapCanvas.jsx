import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { MapContext } from "./MapContext";
import { MapPinned } from "lucide-react";

// Basemap MAPID (MapLibre style JSON) — key sama dengan yang dipakai
// backend (MAPID_API_KEY), sudah terverifikasi jalan di build.md Phase 4B.
const MAPID_KEY = import.meta.env.VITE_MAPID_API_KEY?.trim();
const MAPID_STYLE_URL = `https://v2.basemap.mapid.io/styles/street-v2.0/style.json?key=${encodeURIComponent(MAPID_KEY ?? "")}`;

const JAKARTA_CENTER = [106.8456, -6.2088];

// MapLibre 6 resolves its worker relative to the bundle; Vite must emit it explicitly.
setWorkerUrl(mapWorkerUrl);

export function MapCanvas({ children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPID_KEY) return;

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
      setMapError(null);
    });
    map.on("error", (e) => {
      console.error("[MapCanvas] MapLibre error", { message: e.error?.message?.replace(/key=[^&\s]+/g, "key=[redacted]") });
      setMapError("Peta dasar gagal dimuat. Periksa koneksi dan konfigurasi kunci MAPID.");
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
    <div className="absolute inset-0 bg-slate-100">
      <div ref={containerRef} className="h-full w-full" />
      {(!MAPID_KEY || mapError) && (
        <div role="status" className="map-unavailable">
          <span className="map-unavailable-icon"><MapPinned size={34}/></span>
          <h3>{!MAPID_KEY ? "Peta belum diaktifkan" : "Peta belum bisa dimuat"}</h3>
          <p>{!MAPID_KEY ? "Konfigurasi layanan peta belum tersedia. Kamu tetap bisa menjelajahi tempat melalui daftar rekomendasi." : "Periksa koneksi internet, lalu muat ulang halaman. Daftar tempat tetap dapat digunakan."}</p>
        </div>
      )}
      <MapContext.Provider value={mapInstance}>
        {mapInstance ? children : null}
      </MapContext.Provider>
    </div>
  );
}

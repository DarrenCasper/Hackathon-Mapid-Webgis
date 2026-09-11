import { createContext, useContext } from "react";

// Instance MapLibre GL dibagikan lewat context supaya komponen "layer"
// (IsochroneLayer, PoiMarkers, dst) bisa nambah source/layer tanpa harus
// prop-drilling map instance-nya satu-satu. Nilainya null sebelum peta
// selesai `load` — konsumen harus jaga diri dari null.
export const MapContext = createContext(null);

export function useMap() {
  return useContext(MapContext);
}

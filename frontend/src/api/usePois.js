import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations/:id/pois?minutes= — semua POI di dalam isochrone stasiun
// tsb. Filter kategori/harga/validasi dilakukan CLIENT-SIDE dari hasil
// ini (backend tidak punya query param untuk itu) — lihat frontend.md §5.
export function usePois(stationId, minutes) {
  return useQuery({
    queryKey: ["pois", stationId, minutes],
    queryFn: () => api.get(`/stations/${stationId}/pois?minutes=${minutes}`),
    enabled: Boolean(stationId) && Boolean(minutes),
  });
}

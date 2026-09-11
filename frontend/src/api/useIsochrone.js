import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations/:id/isochrone?minutes= — hanya 10 atau 15 (lihat guide.md,
// frontend.md §1: proposal janji 5/10/15, backend cuma generate 10/15).
export function useIsochrone(stationId, minutes) {
  return useQuery({
    queryKey: ["isochrone", stationId, minutes],
    queryFn: () => api.get(`/stations/${stationId}/isochrone?minutes=${minutes}`),
    enabled: Boolean(stationId) && Boolean(minutes),
  });
}

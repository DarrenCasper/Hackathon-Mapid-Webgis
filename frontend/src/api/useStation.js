import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations/:id — satu stasiun + exits (exits selalu [] saat ini,
// lihat frontend.md §1 — StationExit belum pernah diisi backend).
export function useStation(stationId) {
  return useQuery({
    queryKey: ["station", stationId],
    queryFn: () => api.get(`/stations/${stationId}`),
    enabled: Boolean(stationId),
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations/:id/context?minutes= — ringkasan agregat (poi_count,
// poi_count_by_category, price_distribution). Dipakai BottomStatsBar.
export function useStationContext(stationId, minutes) {
  return useQuery({
    queryKey: ["context", stationId, minutes],
    queryFn: () => api.get(`/stations/${stationId}/context?minutes=${minutes}`),
    enabled: Boolean(stationId) && Boolean(minutes),
  });
}

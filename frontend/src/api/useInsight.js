import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations/:id/insights — teks AI ter-cache (bukan live). `insight`
// dan `generated_at` bisa `null` — itu state normal, bukan error, lihat
// guide.md "About the AI insight feature".
export function useInsight(stationId) {
  return useQuery({
    queryKey: ["insight", stationId],
    queryFn: () => api.get(`/stations/${stationId}/insights`),
    enabled: Boolean(stationId),
  });
}

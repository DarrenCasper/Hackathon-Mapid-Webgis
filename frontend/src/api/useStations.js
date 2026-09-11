import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// GET /stations — semua 90 stasiun, semua region. Lihat guide.md.
export function useStations() {
  return useQuery({
    queryKey: ["stations"],
    queryFn: () => api.get("/stations"),
  });
}

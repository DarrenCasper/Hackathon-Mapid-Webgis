import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// POST /reports — publik, tanpa auth. Body: { station_id, poi_id?,
// report_type, description, photo_url? }. Lihat guide.md.
export function useSubmitReport() {
  return useMutation({
    mutationFn: (payload) => api.post("/reports", payload),
  });
}

export const REPORT_TYPES = [
  { value: "trotoar_rusak", label: "Trotoar rusak" },
  { value: "akses_tertutup", label: "Akses tertutup" },
  { value: "banjir", label: "Banjir" },
  { value: "penyeberangan_tidak_aman", label: "Penyeberangan tidak aman" },
  { value: "tempat_tutup", label: "Tempat tutup" },
  { value: "umkm_baru", label: "UMKM baru" },
  { value: "info_lainnya", label: "Info lainnya" },
];

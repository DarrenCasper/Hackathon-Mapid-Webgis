import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

// POST /stations/:id/chat — publik, tanpa auth, tapi dibatasi di server
// (20 pesan/15 menit/IP). Body: { messages: [{role,content}, ...] }.
// Respons SELALU 200 kalau request-nya valid: { allowed, reason, reply }.
// allowed:false itu keputusan guard (bukan error HTTP) saat pesan
// terakhir dianggap off-topic/upaya injeksi — ditangani sebagai data
// normal oleh pemanggil, bukan lewat onError. Lihat guide.md &
// backend/routes/chat.js.
export function useSendChatMessage(stationId) {
  return useMutation({
    mutationFn: (messages) => api.post(`/stations/${stationId}/chat`, { messages }),
  });
}

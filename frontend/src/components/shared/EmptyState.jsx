import { MapPinOff } from "lucide-react";

// Untuk 404 (stasiun/isochrone tidak ada) atau data yang genuinely sedikit
// (mis. cakung cuma 1 POI, lihat build.md Phase 3) — TIDAK sama dengan
// error. Pesan jujur "data belum memadai", bukan seolah-olah sepi.
// Lihat frontend.md §13.
export function EmptyState({ title = "Data belum tersedia", description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center">
      <MapPinOff className="h-6 w-6 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );
}

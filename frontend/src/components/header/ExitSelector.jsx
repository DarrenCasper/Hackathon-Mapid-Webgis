import { DoorOpen } from "lucide-react";

// [MOCK] — lihat frontend.md §1 & §8: StationExit selalu kosong di
// backend (tidak ada script yang mengisinya). Daripada bangun UI yang
// berpura-pura ada pilihan pintu keluar, tampilkan satu opsi tetap yang
// jujur menjelaskan keterbatasannya lewat title/tooltip.
export function ExitSelector() {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
      title="Data pintu keluar granular per stasiun belum tersedia — memakai titik pusat stasiun"
    >
      <DoorOpen className="h-4 w-4" />
      <span>Pintu Utama (default)</span>
    </div>
  );
}

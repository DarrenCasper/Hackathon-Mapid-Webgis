import { WALK_MINUTES_OPTIONS } from "../../lib/constants";
import { useMapStore } from "../../store/useMapStore";

// Cuma 2 opsi (10/15) — bukan slider 3 titik seperti mockup awal, karena
// backend cuma generate isochrone 10 & 15 menit. Lihat frontend.md §1.
export function WalkTimeToggle() {
  const minutes = useMapStore((s) => s.minutes);
  const setMinutes = useMapStore((s) => s.setMinutes);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Waktu Tempuh Jalan Kaki
      </p>
      <div className="flex gap-2">
        {WALK_MINUTES_OPTIONS.map((m) => (
          <button
            key={m}
            aria-pressed={minutes === m}
            onClick={() => setMinutes(m)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              minutes === m
                ? "border-accent bg-accent text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {m} menit
          </button>
        ))}
      </div>
    </div>
  );
}

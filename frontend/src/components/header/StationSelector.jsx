import { TrainFront } from "lucide-react";
import { useStations } from "../../api/useStations";
import { useMapStore } from "../../store/useMapStore";

export function StationSelector() {
  const { data: stations, isLoading } = useStations();
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const setSelectedStation = useMapStore((s) => s.setSelectedStation);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <TrainFront className="h-4 w-4 text-accent" />
      <select
        className="min-w-[180px] bg-transparent text-sm font-medium text-slate-800 outline-none"
        value={selectedStationId ?? ""}
        disabled={isLoading}
        onChange={(e) => setSelectedStation(e.target.value || null)}
      >
        <option value="" disabled>
          {isLoading ? "Memuat stasiun..." : "Pilih stasiun"}
        </option>
        {stations?.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name}
          </option>
        ))}
      </select>
    </div>
  );
}

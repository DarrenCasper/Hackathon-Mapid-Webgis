import { DoorOpen } from "lucide-react";
import { useStation } from "../../api/useStation";
import { useMapStore } from "../../store/useMapStore";
export function ExitSelector() {
  const {selectedStationId,selectedExitId,setSelectedExit} = useMapStore();
  const {data:station} = useStation(selectedStationId);
  return <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"><DoorOpen size={17}/>{station?.exits?.length ? <select aria-label="Titik awal perjalanan" value={selectedExitId ?? ""} onChange={e => setSelectedExit(e.target.value || null)}><option value="">Pusat stasiun</option>{station.exits.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select> : <span>Titik awal: pusat stasiun</span>}</div>;
}

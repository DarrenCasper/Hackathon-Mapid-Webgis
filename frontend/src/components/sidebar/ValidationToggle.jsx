import { ShieldCheck } from "lucide-react";
import { useMapStore } from "../../store/useMapStore";

export function ValidationToggle() {
  const onlyValidated = useMapStore((s) => s.filters.onlyValidated);
  const setFilters = useMapStore((s) => s.setFilters);

  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-slate-700">
        <ShieldCheck className="h-4 w-4 text-validated" />
        Hanya tervalidasi lapangan
      </span>
      <input
        type="checkbox"
        checked={onlyValidated}
        onChange={(e) => setFilters({ onlyValidated: e.target.checked })}
        className="h-4 w-4 accent-validated"
      />
    </label>
  );
}

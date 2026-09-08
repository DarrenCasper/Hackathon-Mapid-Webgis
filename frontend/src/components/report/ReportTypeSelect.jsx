import { REPORT_TYPES } from "../../api/useReports";

export function ReportTypeSelect({ value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Jenis laporan</label>
      <select
        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-accent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Pilih jenis laporan
        </option>
        {REPORT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

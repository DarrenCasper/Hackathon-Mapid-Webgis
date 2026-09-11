import { useMapStore } from "../../store/useMapStore";

// Filter "di bawah Rp X" berbasis Poi.harga_rata_rata (angka tunggal).
// Batas harga inklusif. Harga tidak diketahui dikeluarkan saat anggaran aktif.
const PRICE_OPTIONS = [
  { label: "Semua harga", value: null },
  { label: "Maks. Rp15.000", value: 15000 },
  { label: "Maks. Rp20.000", value: 20000 },
  { label: "Maks. Rp25.000", value: 25000 },
  { label: "Maks. Rp50.000", value: 50000 },
];

export function PriceFilter() {
  const maxPrice = useMapStore((s) => s.filters.maxPrice);
  const setFilters = useMapStore((s) => s.setFilters);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Anggaran
      </p>
      <select
        aria-label="Anggaran maksimal"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-accent"
        value={maxPrice ?? ""}
        onChange={(e) => setFilters({ maxPrice: e.target.value ? Number(e.target.value) : null })}
      >
        {PRICE_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ""}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

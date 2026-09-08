import { useMapStore } from "../../store/useMapStore";

// Filter "di bawah Rp X" berbasis Poi.harga_rata_rata (angka tunggal).
// TIDAK ada rentang harga (Struk Go di-drop, lihat frontend.md §1) — POI
// dengan harga_rata_rata null tetap ikut ditampilkan sebagai "belum ada
// data harga", bukan disembunyikan/dianggap murah.
const PRICE_OPTIONS = [
  { label: "Semua harga", value: null },
  { label: "< Rp15.000", value: 15000 },
  { label: "< Rp25.000", value: 25000 },
  { label: "< Rp50.000", value: 50000 },
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

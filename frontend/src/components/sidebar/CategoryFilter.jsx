import { CATEGORIES } from "../../lib/constants";
import { useMapStore } from "../../store/useMapStore";

export function CategoryFilter() {
  const categories = useMapStore((s) => s.filters.categories);
  const setFilters = useMapStore((s) => s.setFilters);

  function toggle(value) {
    const next = categories.includes(value)
      ? categories.filter((c) => c !== value)
      : [...categories, value];
    setFilters({ categories: next });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Kategori Kuliner
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const active = categories.includes(cat.value);
          return (
            <button
              key={cat.value}
              aria-pressed={active}
              onClick={() => toggle(cat.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-transparent text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
              style={active ? { backgroundColor: cat.color } : undefined}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

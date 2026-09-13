// Nilai enum PoiCategory persis seperti di prisma/schema.prisma backend —
// jaga sinkron kalau schema berubah.
export const CATEGORIES = [
  { value: "kopi_minuman", label: "Kopi & Minuman", color: "#8B5CF6" },
  { value: "quick_meal", label: "Cepat Saji", color: "#F97316" },
  { value: "warung_makan", label: "Warung Makan", color: "#EF4444" },
  { value: "bakery", label: "Bakery", color: "#EAB308" },
  { value: "casual_dining", label: "Casual Dining", color: "#14B8A6" },
  { value: "hiburan", label: "Hiburan", color: "#EC4899" },
];

export const UNCATEGORIZED_COLOR = "#94A3B8"; // slate-400 — untuk category === null

export function getCategoryMeta(category) {
  return (
    CATEGORIES.find((c) => c.value === category) ?? {
      value: null,
      label: "Belum dikategorikan",
      color: UNCATEGORIZED_COLOR,
    }
  );
}

export const WALK_MINUTES_OPTIONS = [10, 15]; // hanya ini yang digenerate backend, lihat frontend.md §1

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { parseSearchQuery } from "../../lib/nlpParser";
import { useMapStore } from "../../store/useMapStore";

// Search bar "AI-feel" — parsing keyword client-side, BUKAN panggilan LLM.
// Lihat frontend.md §11 untuk kenapa dan rencana upgrade ke endpoint
// backend beneran kalau ada.
export function NlpSearchBar() {
  const [value, setValue] = useState("");
  const setFilters = useMapStore((s) => s.setFilters);
  const setMinutes = useMapStore((s) => s.setMinutes);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = parseSearchQuery(value);
    setSearchQuery(parsed.query);
    setFilters({ categories: parsed.categories, maxPrice: parsed.maxPrice });
    if (parsed.minutes) setMinutes(parsed.minutes);
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-xl">
      <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cari warung murah buka jam 7 pagi, 10 min dari pintu utara..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </form>
  );
}

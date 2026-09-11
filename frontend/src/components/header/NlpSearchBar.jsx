import { Search, ArrowRight } from "lucide-react";
import { parseSearchQuery } from "../../lib/nlpParser";
import { useMapStore } from "../../store/useMapStore";

// Search bar "AI-feel" — parsing keyword client-side, BUKAN panggilan LLM.
// Lihat frontend.md §11 untuk kenapa dan rencana upgrade ke endpoint
// backend beneran kalau ada.
export function NlpSearchBar() {
  const value = useMapStore((s) => s.searchQuery);
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
    <form onSubmit={handleSubmit} className="search-form" role="search">
      <Search size={18} aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Cari tempat, coba ‘kopi murah’"
        aria-label="Cari tempat atau kategori"
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Terapkan pencarian"><ArrowRight size={17}/></button>
    </form>
  );
}

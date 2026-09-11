import { parseSearchQuery } from "./nlpParser.js";

// Shared by the map and recommendation list so both show the same results.
export function applyFilters(pois, filters, searchQuery) {
  const parsedSearch = parseSearchQuery(searchQuery);
  return pois.filter((poi) => {
    if (filters.onlyValidated && !poi.verified_field) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(poi.category)) return false;
    if (filters.maxPrice != null && (poi.harga_rata_rata == null || poi.harga_rata_rata > filters.maxPrice)) return false;
    if (searchQuery && !poi.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      const hasStructuredMatch = parsedSearch.categories.includes(poi.category) ||
        (parsedSearch.maxPrice != null && poi.harga_rata_rata != null && poi.harga_rata_rata <= parsedSearch.maxPrice);
      if (!hasStructuredMatch) return false;
    }
    return true;
  });
}

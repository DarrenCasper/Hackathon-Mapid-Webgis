import { create } from "zustand";

// State UI seputar peta/filter — dipisah dari React Query (server state)
// karena siklus hidupnya beda: klik filter kategori harus instan re-render
// list yang sudah ada di memori, tanpa refetch. Lihat frontend.md §6.
export const useMapStore = create((set) => ({
  selectedStationId: null,
  selectedExitId: null, // [MOCK] selalu null — lihat frontend.md §1, StationExit belum pernah diisi backend
  minutes: 10, // hanya 10 | 15 didukung backend
  filters: {
    categories: [], // subset PoiCategory
    maxPrice: null, // rupiah, difilter client-side di harga_rata_rata
    onlyValidated: false, // filter client-side di verified_field
  },
  selectedPoiId: null,
  searchQuery: "",

  setSelectedStation: (stationId) =>
    set({ selectedStationId: stationId, selectedPoiId: null }),
  setMinutes: (minutes) => set({ minutes }),
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () =>
    set({ filters: { categories: [], maxPrice: null, onlyValidated: false } }),
  setSelectedPoi: (poiId) => set({ selectedPoiId: poiId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

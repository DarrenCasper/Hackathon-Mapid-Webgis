import { RotateCcw } from "lucide-react";
import { WalkTimeToggle } from "./WalkTimeToggle";
import { CategoryFilter } from "./CategoryFilter";
import { PriceFilter } from "./PriceFilter";
import { ValidationToggle } from "./ValidationToggle";
import { useMapStore } from "../../store/useMapStore";

export function FilterSidebar() {
  const resetFilters = useMapStore((state) => state.resetFilters);
  return (
    <div className="filter-sidebar">
      <WalkTimeToggle />
      <CategoryFilter />
      <PriceFilter />
      <ValidationToggle />
      <button className="reset-filters" onClick={resetFilters}><RotateCcw size={14}/> Reset pencarian & filter</button>
    </div>
  );
}

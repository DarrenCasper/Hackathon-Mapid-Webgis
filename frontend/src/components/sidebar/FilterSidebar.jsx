import { WalkTimeToggle } from "./WalkTimeToggle";
import { CategoryFilter } from "./CategoryFilter";
import { PriceFilter } from "./PriceFilter";
import { ValidationToggle } from "./ValidationToggle";

export function FilterSidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <WalkTimeToggle />
      <CategoryFilter />
      <PriceFilter />
      <ValidationToggle />
    </aside>
  );
}

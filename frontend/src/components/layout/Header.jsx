import { MapPin } from "lucide-react";
import { StationSelector } from "../header/StationSelector";
import { ExitSelector } from "../header/ExitSelector";
import { NlpSearchBar } from "../header/NlpSearchBar";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2 font-semibold text-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <MapPin className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline">TransitFit AI</span>
      </div>

      <StationSelector />
      <ExitSelector />
      <NlpSearchBar />
    </header>
  );
}

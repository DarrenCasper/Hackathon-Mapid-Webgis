import { MessageCircleMore } from "lucide-react";

// [MOCK] Shell UI kosong — tidak ada endpoint chat di backend saat ini
// (cuma insight statis ter-cache, lihat StationInsightPanel). Lihat
// frontend.md §9/§11: dibuat sengaja sebagai shell supaya gampang di-hook
// ke endpoint beneran nanti tanpa refactor besar, bukan dibangun sebagai
// fitur yang berpura-pura berfungsi.
export function MiniChatbot() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <MessageCircleMore className="h-4 w-4" />
        Tanya AI seputar stasiun ini
      </div>
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        Segera hadir
      </span>
    </div>
  );
}

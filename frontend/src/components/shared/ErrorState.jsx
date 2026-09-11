import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrorState({ message = "Terjadi kesalahan memuat data", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Coba lagi
        </button>
      )}
    </div>
  );
}

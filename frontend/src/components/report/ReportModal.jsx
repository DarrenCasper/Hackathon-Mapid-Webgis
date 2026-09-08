import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { useUiStore } from "../../store/useUiStore";
import { useMapStore } from "../../store/useMapStore";
import { useSubmitReport } from "../../api/useReports";
import { ReportTypeSelect } from "./ReportTypeSelect";

// POST /reports — publik, tanpa auth, lihat guide.md. Anonim sepenuhnya
// per scope proyek, tidak ada input identitas pelapor.
export function ReportModal() {
  const open = useUiStore((s) => s.reportModalOpen);
  const setOpen = useUiStore((s) => s.setReportModalOpen);
  const selectedStationId = useMapStore((s) => s.selectedStationId);

  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const { mutate, isPending, isSuccess, reset } = useSubmitReport();

  if (!open) return null;

  function handleClose() {
    setOpen(false);
    setReportType("");
    setDescription("");
    reset();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedStationId || !reportType || !description.trim()) return;
    mutate({
      station_id: selectedStationId,
      poi_id: null,
      report_type: reportType,
      description: description.trim(),
      photo_url: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Laporkan Kondisi Jalur</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-validated" />
            <p className="text-sm font-medium text-slate-700">Laporan terkirim, terima kasih!</p>
            <p className="text-xs text-slate-500">Tim moderator akan memverifikasi laporan ini.</p>
            <button
              onClick={handleClose}
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              Tutup
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {!selectedStationId && (
              <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                Pilih stasiun dulu di header sebelum mengirim laporan.
              </p>
            )}
            <ReportTypeSelect value={reportType} onChange={setReportType} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Deskripsi</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-accent"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Genangan air di depan pintu keluar stasiun"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !selectedStationId || !reportType || !description.trim()}
              className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {isPending ? "Mengirim..." : "Kirim Laporan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

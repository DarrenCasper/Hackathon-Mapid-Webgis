import { ShieldCheck, Globe } from "lucide-react";

const SOURCE_LABELS = {
  mapid_missions: "Survei MAPID",
  openstreetmap: "OpenStreetMap",
  jakarta_opendata: "Data Pemerintah",
  mock: "Data contoh",
};

// verified_field === true -> emerald "Tervalidasi Lapangan". Selain itu,
// badge netral menyebut sumber datanya (source), bukan disamaratakan jadi
// "Data Terbuka" generik — lihat guide.md untuk arti tiap nilai `source`.
export function ValidationBadge({ verifiedField, source }) {
  if (verifiedField) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-validated-bg px-2 py-0.5 text-[11px] font-medium text-validated">
        <ShieldCheck className="h-3 w-3" />
        Tervalidasi Lapangan
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted-badge-bg px-2 py-0.5 text-[11px] font-medium text-muted-badge">
      <Globe className="h-3 w-3" />
      {SOURCE_LABELS[source] ?? "Data Terbuka"}
    </span>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Marker } from "maplibre-gl";
import { MapPin, LocateFixed, Camera, CheckCircle2 } from "lucide-react";
import { MapCanvas } from "../components/map/MapCanvas";
import { useMap } from "../components/map/MapContext";
import { ReportTypeSelect } from "../components/report/ReportTypeSelect";
import { StationSelector } from "../components/header/StationSelector";
import { useMapStore } from "../store/useMapStore";
import { useStation } from "../api/useStation";
import { api } from "../lib/apiClient";
import { useReportDraft } from "../store/useReportDraft";
import { RouteReportMap } from "../components/map/RouteReportMap";

function LocationPin({ center, point, onPick }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (center) map.flyTo({ center, zoom: 16 });
    const pick = e => onPick([e.lngLat.lng, e.lngLat.lat]);
    map.on("click", pick);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", pick); map.getCanvas().style.cursor = ""; };
  }, [map, center, onPick]);
  useEffect(() => {
    if (!map || !point) return;
    const marker = new Marker({ color: "#ed4f83", draggable: true }).setLngLat(point).addTo(map);
    marker.on("dragend", () => { const p = marker.getLngLat(); onPick([p.lng, p.lat]); });
    return () => marker.remove();
  }, [map, point, onPick]);
  return <button type="button" className="map-center-pick" onClick={() => { const p = map.getCenter(); onPick([p.lng, p.lat]); }}>Tandai tengah peta</button>;
}

export function ReportPage() {
  const stationId = useMapStore(s => s.selectedStationId);
  const { data: station } = useStation(stationId);
  const capability = useQuery({ queryKey: ["report-capabilities"], queryFn: () => api.get("/reports/capabilities"), retry: 1 });
  const draft = useReportDraft();
  const { type, description, photo, update, clear } = draft;
  const routeContext = draft.routeContext?.stationId === stationId ? draft.routeContext : null;
  const routeReady = !draft.routeContext || (routeContext && capability.data?.route_feedback);
  function chooseEdge(id) {
    const segment = routeContext.segments.find(s => s.edge_id === id);
    update({ routeEdgeId: id, point: segment.coordinates[0], pointStationId: stationId, confirmed: false });
  }
  const point = draft.pointStationId === stationId ? draft.point : null;
  const confirmed = Boolean(point && draft.confirmed);
  const setType = value => update({ type: value });
  const setDescription = value => update({ description: value });
  const setPhoto = value => update({ photo: value });
  const setConfirmed = value => update({ confirmed: value });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(null);
  const [locating, setLocating] = useState(false);
  const sending = useRef(false);
  const dirty = !saved && Boolean(description || type || point || photo);
  const onPick = useCallback(p => update({ point: p, pointStationId: stationId, confirmed: false }), [stationId, update]);
  useEffect(() => {
    if (!dirty) return;
    const before = e => { e.preventDefault(); e.returnValue = ""; };
    const navigate = e => {
      const link = e.target.closest("a[href]");
      if (link && link.getAttribute("href") !== "#/lapor" && !window.confirm("Tinggalkan halaman? Draf laporan belum dikirim.")) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  async function choosePhoto(e) {
    const file = e.target.files?.[0];
    setPhoto(null); setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Pilih JPG, PNG, atau WebP maksimal 2 MB."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.onerror = () => setError("Foto gagal dibaca. Pilih ulang file.");
    reader.readAsDataURL(file);
  }
  function locate() {
    if (!navigator.geolocation) { setError("Browser ini tidak mendukung lokasi."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(p => { onPick([p.coords.longitude, p.coords.latitude]); setLocating(false); }, e => { setError(`Lokasi gagal diperoleh: ${e.message}. Pilih titik langsung pada peta.`); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function submit(e) {
    e.preventDefault();
    if (sending.current || !routeReady || !point || !confirmed || !stationId || !type || !description.trim() || !capability.data?.location) return;
    sending.current = true; setPending(true); setError("");
    try {
      const result = await api.post("/reports", { station_id: stationId, poi_id: null, report_type: type, description: description.trim(), longitude: point[0], latitude: point[1], photo_url: photo, request_id: draft.requestId, ...(routeContext ? { route_edge_ids: [draft.routeEdgeId], route_graph_version: routeContext.graph_version, route_feedback: draft.routeFeedback } : {}) });
      if (result.latitude !== point[1] || result.longitude !== point[0] || !result.id) throw new Error("Server tidak mengonfirmasi titik laporan. Periksa versi backend sebelum mencoba lagi.");
      setSaved(result);
      clear();
    } catch (err) { setError(err.message); }
    finally { sending.current = false; setPending(false); }
  }
  if (saved) return <main className="report-success surface"><CheckCircle2 size={48} /><h1>Laporan berhasil dikirim.</h1><p>Status: menunggu verifikasi tim. Belum memengaruhi peta publik.</p><small>Nomor laporan: {saved.id}</small><a href="#/map" className="primary-action">Kembali ke peta</a></main>;
  return <main className="report-layout"><section className="report-form surface"><span className="eyebrow">LANGKAH LEBIH AMAN, BERSAMA</span><h1>Laporkan kondisi jalur</h1><p className="page-subtitle">Bantu pejalan kaki mengenali hambatan di sekitar stasiun.</p>
    <form onSubmit={submit}><fieldset disabled={pending}><legend className="sr-only">Isi laporan kondisi jalur</legend><StationSelector /><ReportTypeSelect value={type} onChange={setType} />
      {routeContext && <div className="route-feedback-fields"><h2>{draft.routeFeedback === "avoid" ? "Usulkan ruas untuk dihindari" : "Rekomendasikan ruas ini"}</h2><label htmlFor="report-edge">Pilih ruas yang diperiksa</label><select id="report-edge" value={draft.routeEdgeId} onChange={e => chooseEdge(e.target.value)}>{routeContext.segments.filter((s, i, list) => list.findIndex(x => x.edge_id === s.edge_id) === i).map((s, i) => <option key={s.edge_id} value={s.edge_id}>{i + 1}. {s.name} · {Math.round(s.distance_m)} m</option>)}</select><p>Belum mengubah rute siapa pun. Admin harus memeriksa bukti dan mengonfirmasi kondisi lapangan sebelum ruas diblokir atau direkomendasikan.</p></div>}
      {!routeReady && <p role="alert" className="warning-note">Laporan ruas belum siap. Gunakan stasiun asal rute dan layanan laporan terbaru.</p>}
      <div className="location-summary"><MapPin /><div><strong>{point ? "Titik laporan dipilih" : "Tandai lokasi di peta"}</strong><p>{point ? `${point[1].toFixed(6)}, ${point[0].toFixed(6)}` : "Ketuk peta, lalu konfirmasi titik. Titik bukan otomatis lokasi stasiun."}</p></div></div>
      <button type="button" className="secondary-action" onClick={locate} disabled={locating}><LocateFixed size={18} />{locating ? "Mencari lokasi…" : "Gunakan lokasi saya"}</button>
      {point && <label className="confirm-location"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Saya memastikan titik ini adalah lokasi yang dilaporkan.</label>}
      <label className="field-label" htmlFor="report-description">Ceritakan kondisi jalur</label><textarea id="report-description" required minLength={5} maxLength={2000} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Apa hambatannya? Bagaimana dampaknya bagi pejalan kaki?" />
      <label className="photo-upload"><Camera size={20} />Tambah foto (opsional)<input aria-label="Tambah foto laporan" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /><small>JPG, PNG, WebP · maksimal 2 MB. Hindari wajah dan data pribadi.</small></label>
      {photo && <div><img className="report-photo" src={photo} alt="Pratinjau foto laporan" /><button type="button" onClick={() => setPhoto(null)}>Hapus foto</button></div>}
      {capability.isPending && <p role="status">Memeriksa layanan laporan…</p>}
      {(capability.error || (capability.data && !capability.data.location)) && <div role="alert" className="warning-note">Backend ini belum mendukung laporan bertitik peta. Aktifkan backend versi terbaru dan migrasi database terlebih dahulu.<button type="button" onClick={() => capability.refetch()}>Periksa lagi</button></div>}
      {error && <p role="alert" className="warning-note">{error}</p>}
      <p className="soft-note">Laporan akan ditinjau moderator. Pengiriman tidak langsung mengubah rute atau peta publik.</p>
      <button className="primary-action" disabled={!routeReady || !capability.data?.location || !stationId || !type || description.trim().length < 5 || !confirmed || pending}>{pending ? "Mengirim laporan…" : "Kirim laporan"}</button></fieldset></form></section>
    <section className="report-map-section"><div className="report-map"><MapCanvas><LocationPin center={point ?? station?.location?.coordinates} point={point} onPick={onPick} />{routeContext && <RouteReportMap segments={routeContext.segments} selectedId={draft.routeEdgeId} />}</MapCanvas></div><div className="surface map-help"><MapPin size={19} /><p>Ketuk untuk menaruh pin. Geser pin atau ketuk ulang untuk memperbaiki posisi, lalu konfirmasi di formulir.</p></div></section></main>;
}

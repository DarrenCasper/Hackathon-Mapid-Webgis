import { useEffect } from "react";
import { Footprints } from "lucide-react";
import { useMap } from "./MapContext";
import { useBrowserRoute } from "../../lib/routing/useBrowserRoute";
import { useMapStore } from "../../store/useMapStore";
import { useReportDraft } from "../../store/useReportDraft";
import { formatMeters } from "../../lib/geo";

export function WalkingRouteLine({ from, to }) {
  const map = useMap();
  const stationId = useMapStore(s=>s.selectedStationId);
  const draft = useReportDraft();
  const route = useBrowserRoute(stationId,from,to);
  function feedback(kind) {
    if (draft.description && !window.confirm("Mulai laporan ruas baru dan ganti draf laporan sebelumnya?")) return;
    const segment=route.data.segments[0];
    if(!segment)return;
    draft.clear();
    draft.update({routeContext:{...route.data,stationId},routeFeedback:kind,routeEdgeId:segment.edge_id,pointStationId:stationId,point:segment.coordinates[0],type:"info_lainnya"});
    window.location.hash="/lapor";
  }
  useEffect(() => {
    if (!map || !route.data) return;
    const data = {type:"Feature",properties:{},geometry:{type:"LineString",coordinates:route.data.coordinates}};
    map.addSource("walking-route",{type:"geojson",data});
    map.addLayer({id:"walking-route-halo",type:"line",source:"walking-route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#fff","line-width":9}});
    map.addLayer({id:"walking-route-line",type:"line",source:"walking-route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#7948eb","line-width":5}});
    const bounds = route.data.coordinates.reduce((b,p) => [[Math.min(b[0][0],p[0]),Math.min(b[0][1],p[1])],[Math.max(b[1][0],p[0]),Math.max(b[1][1],p[1])]],[[Infinity,Infinity],[-Infinity,-Infinity]]);
    map.fitBounds(bounds,{padding:65,maxZoom:17,duration:500});
    return () => {
      for (const id of ["walking-route-line","walking-route-halo"]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource("walking-route")) map.removeSource("walking-route");
    };
  },[map,route.data]);
  return <div className="route-summary browser-route" role={route.error ? "alert" : "status"}><Footprints size={22}/><div>{route.error ? route.error : !route.data ? "Mencari jalur berjalan…" : <><strong>{formatMeters(route.data.distance_m)} · {Math.max(1,Math.round(route.data.duration_s/60))} menit jalan</strong><small>Ruas terblokir terverifikasi dihindari. Estimasi 4,5 km/jam.</small><small>Akses ke jaringan: awal {route.data.snap_start_m} m, tujuan {route.data.snap_end_m} m (di luar jarak rute).</small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></>}</div><div className="route-actions"><button disabled={route.isFetching} onClick={()=>route.refresh()}>{route.error ? "Coba lagi" : "Cek & hitung ulang"}</button>{route.data?.segments.length>0 && <><button onClick={()=>feedback("avoid")}>Laporkan ruas buruk</button><button onClick={()=>feedback("recommend")}>Rekomendasikan ruas</button></>}</div></div>;
}

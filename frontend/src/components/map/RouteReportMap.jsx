import {useEffect} from "react";
import {useMap} from "./MapContext";
export function RouteReportMap({segments,selectedId}) {
  const map=useMap();
  useEffect(()=>{
    if(!map)return;
    map.addSource("report-route",{type:"geojson",data:{type:"FeatureCollection",features:segments.map(s=>({type:"Feature",properties:{selected:s.edge_id===selectedId},geometry:{type:"LineString",coordinates:s.coordinates}}))}});
    map.addLayer({id:"report-route",type:"line",source:"report-route",paint:{"line-width":6,"line-color":["case",["get","selected"],"#ed4f83","#8758de"]}});
    return ()=>{if(map.getLayer("report-route"))map.removeLayer("report-route");if(map.getSource("report-route"))map.removeSource("report-route");};
  },[map,segments,selectedId]);
  return null;
}

import {useEffect,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {api} from "../../lib/apiClient";
export function useBrowserRoute(stationId,from,to) {
  const graph=useQuery({queryKey:["walking-graph",stationId],queryFn:({signal})=>api.getSignal(`/stations/${encodeURIComponent(stationId)}/walking-graph`,signal),enabled:Boolean(stationId),staleTime:300000,retry:1});
  const policy=useQuery({queryKey:["route-policy",stationId,graph.data?.version],queryFn:({signal})=>api.getSignal(`/stations/${encodeURIComponent(stationId)}/route-policy`,signal),enabled:Boolean(graph.data),staleTime:0,refetchInterval:30000,refetchOnWindowFocus:"always",retry:1});
  const [calculation,setCalculation]=useState({key:null,data:null,error:null});
  const [attempt,setAttempt]=useState(0);
  const invalidPolicy=policy.data && (!Array.isArray(policy.data.blocked_edge_ids) || !Array.isArray(policy.data.recommended_edge_ids));
  const key=JSON.stringify([stationId,graph.data?.version,from,to,policy.data,policy.isError,attempt]);
  useEffect(()=>{
    if(!graph.data || !policy.data || policy.isError || invalidPolicy || policy.data.graph_version!==graph.data.version)return;
    const worker=new Worker(new URL("./route.worker.js",import.meta.url),{type:"module"});
    worker.onmessage=({data})=>{setCalculation({key,data:data.result ?? null,error:data.error ?? null});worker.terminate();};
    worker.onerror=()=>{setCalculation({key,data:null,error:"Pencarian rute di perangkat gagal. Coba lagi."});worker.terminate();};
    worker.postMessage({graph:graph.data,from,to,blocked:policy.data.blocked_edge_ids,recommended:policy.data.recommended_edge_ids});
    return ()=>worker.terminate();
  },[key,graph.data,policy.data,policy.isError,invalidPolicy,from,to]);
  const mismatch=graph.data && policy.data && graph.data.version!==policy.data.graph_version;
  return {data:!invalidPolicy&&!graph.error&&!policy.error&&!mismatch&&calculation.key===key?calculation.data:null,error:graph.error?.message || policy.error?.message || (invalidPolicy?"Status ruas dari server tidak lengkap. Coba lagi.":null) || (mismatch?"Graf dan status ruas berbeda versi. Muat ulang halaman.":null) || (calculation.key===key?calculation.error:null),graph:graph.data,refresh:async()=>{await graph.refetch();await policy.refetch();setAttempt(value=>value+1);},isFetching:graph.isFetching||policy.isFetching};
}

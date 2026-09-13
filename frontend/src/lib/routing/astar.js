/**
 * @typedef {[number, number]} Point
 * @typedef {{id:string,from:string,to:string,distance_m:number,bidirectional:boolean,name:string}} Edge
 * @typedef {{nodes:Record<string,Point>,edges:Edge[],version:string}} Graph
 */
export function meters(a,b) {
  const rad=Math.PI/180;
  const h=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function snap(graph,point) {
  let best=null;
  for(const edge of graph.edges) {
    const a=graph.nodes[edge.from],b=graph.nodes[edge.to],scale=Math.cos(point[1]*Math.PI/180);
    const dx=(b[0]-a[0])*scale,dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((point[0]-a[0])*scale*dx+(point[1]-a[1])*dy)/den)):0;
    const coordinate=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],distance=meters(point,coordinate);
    if(!best || distance<best.distance) best={edge,t,coordinate,distance};
  }
  if(!best || best.distance>75) throw new Error("Titik lebih dari 75 m dari jaringan jalan kaki. Pilih pintu keluar atau tujuan yang lebih dekat ke jalan.");
  return best;
}
/** Lowest cost on the supplied walking graph, with immutable caller inputs. */
export function findRoute(graph,from,to,blockedIds,recommendedIds) {
  if(!graph?.edges?.length || !graph.nodes) throw new Error("Graf jalan kosong.");
  const blocked=new Set(blockedIds), recommended=new Set(recommendedIds);
  const start=snap(graph,from),end=snap(graph,to);
  if(blocked.has(start.edge.id) || blocked.has(end.edge.id)) throw new Error("Akses awal atau tujuan berada pada ruas yang diblokir. Pilih titik akses lain.");
  const nodes={...graph.nodes,"@start":start.coordinate,"@end":end.coordinate};
  const adjacency=new Map(Object.keys(nodes).map(id=>[id,[]]));
  const add=(a,b,edge,distance)=>adjacency.get(a).push({to:b,id:edge.id,distance,cost:distance*(recommended.has(edge.id)?1:1.12)});
  for(const edge of graph.edges) {
    if(blocked.has(edge.id)) continue;
    if(!nodes[edge.from] || !nodes[edge.to] || !Number.isFinite(edge.distance_m) || edge.distance_m<meters(nodes[edge.from],nodes[edge.to])-.01) throw new Error("Graf jalan tidak valid.");
    add(edge.from,edge.to,edge,edge.distance_m);
    if(edge.bidirectional) add(edge.to,edge.from,edge,edge.distance_m);
  }
  add("@start",start.edge.to,start.edge,(1-start.t)*start.edge.distance_m);
  if(start.edge.bidirectional || start.t===0) add("@start",start.edge.from,start.edge,start.t*start.edge.distance_m);
  add(end.edge.from,"@end",end.edge,end.t*end.edge.distance_m);
  if(end.edge.bidirectional || end.t===1) add(end.edge.to,"@end",end.edge,(1-end.t)*end.edge.distance_m);
  if(start.edge.id===end.edge.id && (end.t>=start.t || start.edge.bidirectional)) add("@start","@end",start.edge,Math.abs(end.t-start.t)*start.edge.distance_m);
  const heap=[];
  const push=item=>{
    heap.push(item);let i=heap.length-1;
    while(i>0){const p=(i-1)>>1;if(heap[p].priority<=item.priority)break;heap[i]=heap[p];i=p;}heap[i]=item;
  };
  const pop=()=>{
    const first=heap[0],last=heap.pop();
    if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].priority<heap[c].priority)c++;if(heap[c].priority>=last.priority)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;
  };
  const scores=new Map([["@start",0]]),previous=new Map();
  push({id:"@start",cost:0,priority:meters(start.coordinate,end.coordinate)});
  while(heap.length) {
    const current=pop();
    if(current.cost!==scores.get(current.id))continue;
    if(current.id==="@end") {
      const path=[];let node="@end";
      while(node!=="@start"){const step=previous.get(node);path.push({from:step.from,to:node,id:step.id,distance:step.distance});node=step.from;}
      path.reverse();
      const segments=path.filter(p=>p.distance>.001).map(p=>({edge_id:p.id,coordinates:[nodes[p.from],nodes[p.to]],distance_m:p.distance,name:graph.edges.find(e=>e.id===p.id)?.name ?? "Ruas jalan"}));
      const distance=path.reduce((sum,p)=>sum+p.distance,0);
      return {coordinates:["@start",...path.map(p=>p.to)].map(id=>nodes[id]),segments,edge_ids:[...new Set(segments.map(p=>p.edge_id))],distance_m:Math.round(distance),duration_s:Math.round(distance/1.25),snap_start_m:Math.round(start.distance),snap_end_m:Math.round(end.distance),graph_version:graph.version};
    }
    for(const edge of adjacency.get(current.id)){
      const score=current.cost+edge.cost;
      if(score<(scores.get(edge.to)??Infinity)){scores.set(edge.to,score);previous.set(edge.to,{from:current.id,...edge});push({id:edge.to,cost:score,priority:score+meters(nodes[edge.to],end.coordinate)});}
    }
  }
  throw new Error("Tidak ditemukan rute alternatif pada graf area ini setelah ruas terblokir dihindari.");
}

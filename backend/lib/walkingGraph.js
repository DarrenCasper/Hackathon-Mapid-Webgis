const { createHash } = require("node:crypto");
const prisma = require("./db");
const { getStationOrNull } = require("./stations");

function meters(a,b) {
  const rad = Math.PI/180;
  const h = Math.sin((b[1]-a[1])*rad/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function allowed(tags) {
  if(tags["access:conditional"] || tags["foot:conditional"])return false;
  if (["no","private"].includes(tags.foot)) return false;
  if (["yes","designated","permissive"].includes(tags.foot)) return true;
  if (["no","private"].includes(tags.access) || tags["access:conditional"] || tags["foot:conditional"]) return false;
  return ["footway","path","pedestrian","steps","residential","living_street","service","unclassified","tertiary","secondary","primary","track"].includes(tags.highway);
}
function buildGraph(elements) {
  const sourceNodes = new Map(elements.filter(e=>e.type==="node").map(e=>[e.id,e]));
  const nodes = {};
  const edges = [];
  for (const way of elements.filter(e=>e.type==="way" && e.nodes?.length>1 && allowed(e.tags ?? {}))) {
    for (let i=1;i<way.nodes.length;i++) {
      const a=sourceNodes.get(way.nodes[i-1]), b=sourceNodes.get(way.nodes[i]);
      if (!a || !b) throw new Error("OSM graph incomplete: missing way node.");
      if ([a,b].some(n=>n.tags && (["no","private"].includes(n.tags.foot) || (n.tags.barrier && !["entrance","kerb"].includes(n.tags.barrier) && !["yes","designated","permissive"].includes(n.tags.foot))))) continue;
      const from=String(a.id),to=String(b.id), distance=meters([a.lon,a.lat],[b.lon,b.lat]);
      if (!Number.isFinite(distance) || distance<=0) continue;
      nodes[from]=[a.lon,a.lat]; nodes[to]=[b.lon,b.lat];
      const direction=way.tags?.["foot:forward"]==="no" ? "-1" : way.tags?.["foot:backward"]==="no" ? "yes" : way.tags?.["oneway:foot"];
      edges.push({id:`osm:${way.id}:${Math.min(a.id,b.id)}:${Math.max(a.id,b.id)}`,from:direction==="-1"?to:from,to:direction==="-1"?from:to,distance_m:distance,bidirectional:!["yes","1","-1"].includes(direction),name:way.tags?.name || way.tags?.highway});
    }
  }
  if (!edges.length) throw new Error("Tidak ada jaringan jalan kaki pada area ini.");
  if (edges.length>60000) throw new Error("Graf terlalu besar untuk area browser; kurangi radius sumber graf.");
  return {nodes,edges,attribution:"© OpenStreetMap contributors",license:"https://www.openstreetmap.org/copyright"};
}
async function loadGraph(stationId) {
  const existing=await prisma.walkingGraph.findUnique({where:{station_id:stationId}});
  if (existing) return existing;
  const station=await getStationOrNull(stationId);
  if (!station) throw Object.assign(new Error("Stasiun tidak ditemukan."),{status:404});
  const url=process.env.OVERPASS_URL;
  if (!url) throw Object.assign(new Error("Sumber graf jalan belum dikonfigurasi."),{status:503});
  const [lon,lat]=station.location.coordinates;
  const query=`[out:json][timeout:25];way(around:2200,${lat},${lon})["highway"];(._;>;);out body;`;
  let lastError;
  for (let attempt=1;attempt<=2;attempt++) {
    try {
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json","User-Agent":"TransitFit/1.0"},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(30000)});
      const raw=await response.text();
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}: ${raw.slice(0,300)}`);
      const parsed=JSON.parse(raw);
      if (parsed.remark || !Array.isArray(parsed.elements)) throw new Error("Respons Overpass tidak lengkap.");
      const data=buildGraph(parsed.elements);
      const version=createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0,24);
      return await prisma.walkingGraph.upsert({where:{station_id:stationId},create:{station_id:stationId,version,data},update:{}});
    } catch(error) {
      lastError=error;
      console.warn("graph_load_failed",{stationId,attempt,message:error.message});
    }
  }
  throw Object.assign(new Error(`Gagal memuat graf jalan: ${lastError.message}`),{status:502});
}
function routePolicy(reports, graph) {
  const ids=new Set(graph.edges.map(e=>e.id));
  const blocked=new Set(),recommended=new Set();
  for (const report of reports) {
    if (report.status!=="applied" || !report.verification_evidence || !report.verified_on_site_at) continue;
    for (const id of report.route_edge_ids) if (ids.has(id)) (report.route_feedback==="avoid"?blocked:recommended).add(id);
  }
  return {blocked_edge_ids:[...blocked].sort(),recommended_edge_ids:[...recommended].filter(id=>!blocked.has(id)).sort()};
}
function edgeDistance(graph,id,point) {
  const edge=graph.edges.find(e=>e.id===id),a=graph.nodes[edge.from],b=graph.nodes[edge.to];
  const scale=Math.cos(point[1]*Math.PI/180),dx=(b[0]-a[0])*scale,dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((point[0]-a[0])*scale*dx+(point[1]-a[1])*dy)/den)):0;
  return meters(point,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
}
module.exports={buildGraph,loadGraph,routePolicy,edgeDistance};

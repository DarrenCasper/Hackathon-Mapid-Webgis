const assert=require("node:assert/strict");
const express=require("express");
const {once}=require("node:events");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const {validateReport}=require("../lib/reportValidation");
const {routePolicy,buildGraph}=require("../lib/walkingGraph");
const {decisionError,registerRouteModeration}=require("../lib/routeModeration");
const requireAuth=require("../middleware/auth");
const reports=require("../routes/reports");
const prisma=require("../lib/db");
async function main(){
  const {findRoute,meters}=await import(pathToFileURL(path.resolve(__dirname,"../../frontend/src/lib/routing/astar.js")));
  const {routingGraph:graph,from,to}=await import(pathToFileURL(path.resolve(__dirname,"../../frontend/qa/routing-fixture.mjs")));
  const before=JSON.stringify(graph);
  const shortest=findRoute(graph,from,to,[],[]);
  assert.ok(shortest.edge_ids.includes("bad"));
  const report={id:"r",status:"pending",route_edge_ids:["bad"],route_feedback:"avoid",route_graph_version:graph.version,verification_evidence:null,verified_on_site_at:null};
  assert.deepEqual(routePolicy([report],graph).blocked_edge_ids,[]);
  assert.deepEqual(routePolicy([{...report,status:"verified"}],graph).blocked_edge_ids,[]);
  assert.deepEqual(routePolicy([{...report,status:"applied"}],graph).blocked_edge_ids,[]);
  const approved={...report,status:"applied",verification_evidence:"Inspected on site with photo reference",verified_on_site_at:new Date()};
  const policy=routePolicy([approved],graph);
  const rerouted=findRoute(graph,from,to,policy.blocked_edge_ids,[]);
  assert.ok(!rerouted.edge_ids.includes("bad"));
  assert.ok(rerouted.edge_ids.includes("detour-2"));
  assert.ok(rerouted.distance_m>shortest.distance_m);
  const nearbyNodes={...graph.nodes,u:[106.8435,-6.19947],v:[106.8445,-6.19947]};
  const nearbyGraph={...graph,nodes:nearbyNodes,edges:graph.edges.map(e=>({...e,distance_m:meters(nearbyNodes[e.from],nearbyNodes[e.to])}))};
  assert.ok(!findRoute(nearbyGraph,from,to,[],[]).edge_ids.includes("detour-2"));
  assert.ok(findRoute(nearbyGraph,from,to,[],["detour-1","detour-2","detour-3"]).edge_ids.includes("detour-2"));
  assert.deepEqual(routePolicy([{...approved,status:"rejected"}],graph).blocked_edge_ids,[]);
  assert.deepEqual(routePolicy([approved,{...approved,id:"p",route_feedback:"recommend"}],graph).recommended_edge_ids,[]);
  assert.throws(()=>findRoute(graph,from,to,["bad","detour-1"],[]),/Tidak ditemukan/);
  assert.throws(()=>findRoute(graph,from,to,["entry"],[]),/Akses awal/);
  assert.equal(JSON.stringify(graph),before);
  const same=findRoute(graph,[106.84325,-6.1995],[106.8434,-6.1995],[],[]);
  assert.deepEqual(same.edge_ids,["entry"]);
  const oneWay={...graph,edges:graph.edges.map(e=>({...e,bidirectional:false}))};
  assert.throws(()=>findRoute(oneWay,to,from,[],[]),/Tidak ditemukan/);
  assert.ok(decisionError({decision:"approve",confirmed_on_site:false,evidence:"Bukti pemeriksaan panjang"},report,{version:graph.version,data:graph}));
  assert.equal(decisionError({decision:"approve",confirmed_on_site:true,evidence:"Bukti pemeriksaan panjang"},report,{version:graph.version,data:graph}),null);
  assert.ok(decisionError({decision:"approve",confirmed_on_site:true,evidence:"Bukti pemeriksaan panjang"},report,{version:"old",data:graph}));
  const osm=[{type:"node",id:1,lon:106,lat:-6},{type:"node",id:2,lon:106.001,lat:-6},{type:"node",id:3,lon:106.002,lat:-6},
    {type:"way",id:10,nodes:[1,2],tags:{highway:"footway","oneway:foot":"yes"}},
    {type:"way",id:11,nodes:[2,3],tags:{highway:"residential",foot:"no"}}];
  const converted=buildGraph(osm);assert.equal(converted.edges.length,1);assert.equal(converted.edges[0].bidirectional,false);
  const payload={station_id:"cikini",report_type:"trotoar_rusak",description:"Jalur berlubang.",longitude:106.843,latitude:-6.199,request_id:"7c90b930-bb93-4b8c-a36a-6dce3ae3d679",photo_url:null};
  assert.equal(validateReport(payload),null);
  const app=express();app.use(express.json());app.use("/api/reports",reports);
  const admin=express.Router();admin.use(requireAuth);registerRouteModeration(admin);app.use("/api/admin",admin);
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  try{
    const base=`http://127.0.0.1:${server.address().port}/api`;
    let response=await fetch(base+"/admin/reports/r/route-decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"approve",confirmed_on_site:true})});
    assert.equal(response.status,401);
    response=await fetch(base+"/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,latitude:null})});assert.equal(response.status,400);
    console.log("PASS: A* shortest/detour/same-edge/one-way/no-path/immutable inputs, pending+unverified reports do not block, approved policy blocks, revoke unblocks, blacklist precedence, evidence/version guards, OSM foot access, HTTP admin authorization. No database writes.");
  }finally{await new Promise(resolve=>server.close(resolve));await prisma.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

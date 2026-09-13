import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {routingGraph,from,to} from "./routing-fixture.mjs";
import {findRoute} from "../src/lib/routing/astar.js";
const [playwrightPath,output]=process.argv.slice(2);
const {chromium,devices}=await import(pathToFileURL(playwrightPath).href);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
for(const [name,options] of [["desktop",{viewport:{width:1440,height:1000}}],["android",devices["Pixel 7"]]]){
  const context=await browser.newContext(options),page=await context.newPage();
  const errors=[];let report=null,workerCount=0,legacyCalls=0,decisionCount=0;
  page.on("pageerror",e=>errors.push(e.message));
  page.on("worker",worker=>{if(worker.url().includes("route.worker"))workerCount++;});
  await context.route("**/v2.basemap.mapid.io/**",r=>r.fulfill({json:{version:8,sources:{},layers:[{id:"bg",type:"background",paint:{"background-color":"#ebe8f0"}}]}}));
  await context.route("https://mapidapi.darrencasper.com/api/**",async r=>{
    const path=new URL(r.request().url()).pathname.replace("/api",""),body=r.request().method()==="POST"?r.request().postDataJSON():null;
    const station={id:"cikini",name:"Stasiun Cikini",location:{type:"Point",coordinates:from},exits:[]};
    let data;
    if(path==="/walking-route"){legacyCalls++;return r.fulfill({status:500,json:{error:"Server route must not be used"}});}
    if(path==="/stations")data=[station];
    else if(path==="/stations/cikini")data=station;
    else if(path.endsWith("/walking-graph"))data=routingGraph;
    else if(path.endsWith("/route-policy"))data={graph_version:routingGraph.version,blocked_edge_ids:report?.status==="applied"&&report.route_feedback==="avoid"?report.route_edge_ids:[],recommended_edge_ids:report?.status==="applied"&&report.route_feedback==="recommend"?report.route_edge_ids:[]};
    else if(path.endsWith("/pois"))data=[{id:1,name:"Tujuan Uji",category:"kopi_minuman",source:"openstreetmap",harga_rata_rata:10000,location:{type:"Point",coordinates:to}}];
    else if(path.endsWith("/isochrone"))data={polygon:{type:"Polygon",coordinates:[[[106.842,-6.201],[106.846,-6.201],[106.846,-6.197],[106.842,-6.197],[106.842,-6.201]]]}};
    else if(path.endsWith("/insights"))data={insight:null};
    else if(path.endsWith("/context"))data={poi_count:1,poi_count_by_category:{kopi_minuman:1}};
    else if(path==="/reports/capabilities")data={location:true,photo:true,route_feedback:true};
    else if(path==="/reports"){assert.deepEqual(body.route_edge_ids,["bad"]);report={...body,id:"r1",station,status:"pending",route_decisions:[]};data=report;}
    else if(path==="/admin/login")data={token:"qa-session"};
    else if(path.startsWith("/admin/")){
      assert.equal(r.request().headers().authorization,"Bearer qa-session");
      if(path==="/admin/reports"){const status=new URL(r.request().url()).searchParams.get("status");data=report?.status===status?[report]:[];}
      else if(path.endsWith("/route-decision")){
        if(body.decision==="approve"){assert.equal(body.confirmed_on_site,true);assert.ok(body.evidence.length>=10);report={...report,status:"applied"};}
        else if(body.decision==="revoke")report={...report,status:"rejected"};
        decisionCount++;data={id:report.id,status:report.status};
      }
    }
    if(data===undefined)return r.fulfill({status:404,json:{error:"No fixture for "+path}});
    return r.fulfill({json:data});
  });
  await page.goto("http://127.0.0.1:5174/#/tempat");
  await page.getByLabel("Stasiun awal").selectOption("cikini");
  await page.locator(".place-card").click();
  await page.getByRole("link",{name:"Map",exact:true}).click();
  const initial=findRoute(routingGraph,from,to,[],[]).distance_m;
  const detour=findRoute(routingGraph,from,to,["bad"],[]).distance_m;
  await page.locator(".route-summary strong").filter({hasText:initial+" m"}).waitFor();
  assert.ok(workerCount>0);assert.equal(legacyCalls,0);
  await page.getByRole("button",{name:"Laporkan ruas buruk"}).click();
  await page.getByLabel("Pilih ruas yang diperiksa").selectOption("bad");
  await page.getByLabel("Ceritakan kondisi jalur").fill("Trotoar tertutup; bukti pemeriksaan diperlukan.");
  await page.getByLabel("Saya memastikan titik ini adalah lokasi yang dilaporkan.").check();
  await page.getByRole("button",{name:"Kirim laporan",exact:true}).click();
  await page.getByRole("heading",{name:"Laporan berhasil dikirim."}).waitFor();
  await page.getByRole("link",{name:"Kembali ke peta",exact:true}).click();
  await page.locator(".route-summary strong").filter({hasText:initial+" m"}).waitFor();
  assert.equal(report.status,"pending");
  await page.getByRole("link",{name:"Admin",exact:true}).click();
  await page.getByLabel("Email",{exact:true}).fill("qa@example.test");
  await page.getByLabel("Password",{exact:true}).fill("fixture-only");
  await page.getByRole("button",{name:"Masuk",exact:true}).click();
  const approve=page.getByRole("button",{name:"Setujui & terapkan"});
  await approve.waitFor();assert.equal(await approve.isDisabled(),true);
  await page.getByLabel("Bukti pemeriksaan / alasan keputusan").fill("Pemeriksaan lapangan fixture dengan referensi foto.");
  assert.equal(await approve.isDisabled(),true);
  await page.getByLabel("Saya telah memverifikasi kondisi lapangan dengan bukti yang dapat dipertanggungjawabkan.").check();
  await page.screenshot({path:output+"/"+name+"-admin-verification.png",fullPage:true});
  await approve.click();
  await page.getByText("Tidak ada laporan ruas pada status ini.").waitFor();
  await page.getByRole("link",{name:"Map",exact:true}).click();
  await page.locator(".route-summary strong").filter({hasText:detour+" m"}).waitFor();
  await page.screenshot({path:output+"/"+name+"-astar-detour.png",fullPage:true});
  await page.getByRole("link",{name:"Admin",exact:true}).click();
  await page.getByLabel("Email",{exact:true}).fill("qa@example.test");await page.getByLabel("Password",{exact:true}).fill("fixture-only");await page.getByRole("button",{name:"Masuk",exact:true}).click();
  await page.getByLabel("Status laporan").selectOption("applied");
  await page.getByLabel("Bukti pemeriksaan / alasan keputusan").fill("Jalur sudah diperbaiki dan diperiksa kembali.");
  await page.getByRole("button",{name:"Cabut keputusan"}).click();
  await page.getByText("Tidak ada laporan ruas pada status ini.").waitFor();
  await page.getByRole("link",{name:"Map",exact:true}).click();
  await page.locator(".route-summary strong").filter({hasText:initial+" m"}).waitFor();
  assert.equal(decisionCount,2);assert.equal(report.status,"rejected");assert.equal(legacyCalls,0);
  await page.getByRole("button",{name:"Rekomendasikan ruas"}).click();
  await page.getByRole("heading",{name:"Rekomendasikan ruas ini"}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  await context.close();
}
console.log("PASS desktop+Android: actual browser A* Worker, zero server route calls, feedback edge selection, pending unchanged, admin evidence+confirmation required, approved blacklist reroutes, revoke restores, recommend UI. HTTP/DB fixtures isolated.");
}finally{await browser.close();}

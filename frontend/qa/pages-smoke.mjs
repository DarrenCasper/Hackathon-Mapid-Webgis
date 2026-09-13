import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { routingGraph, from, to } from "./routing-fixture.mjs";
import { findRoute } from "../src/lib/routing/astar.js";
const [playwrightPath,outputPath] = process.argv.slice(2);
if (!playwrightPath || !outputPath) throw new Error("Provide Playwright module path and output directory.");
const {chromium,devices} = await import(pathToFileURL(playwrightPath).href);
await mkdir(outputPath,{recursive:true});
const browser = await chromium.launch({headless:true,channel:"chrome"});
const station = {id:"cikini",name:"Stasiun Cikini",location:{type:"Point",coordinates:from},exits:[]};
const pois = [
  {id:1,name:"Kopi Hemat",category:"kopi_minuman",harga_rata_rata:10000,menu_utama:"Kopi susu",jam_buka:"07:00",jam_tutup:"20:00"},
  {id:2,name:"Warung Sore",category:"warung_makan",harga_rata_rata:30000},
  {id:3,name:"Kopi Tanpa Harga",category:"kopi_minuman",harga_rata_rata:null}
].map(p=>({...p,source:"osm",verified_field:false,location:{type:"Point",coordinates:to}}));
const errors = [];
let submitted;
let failReport = true;
let routeCalls = 0;
let failRoute = true;
async function fixtures(context) {
  await context.route("**/v2.basemap.mapid.io/**", route => route.fulfill({json:{version:8,sources:{},layers:[{id:"test-background",type:"background",paint:{"background-color":"#eeeaf4"}}]}}));
  await context.route("https://mapidapi.darrencasper.com/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api","");
    let data;
    if (path === "/stations") data = [station];
    else if (path === "/stations/cikini") data = station;
    else if (path.endsWith("/pois")) data = pois;
    else if (path.startsWith("/pois/")) data = pois.find(p=>String(p.id)===path.split("/").pop());
    else if (path.endsWith("/isochrone")) data = {polygon:{type:"Polygon",coordinates:[[[106.839,-6.204],[106.85,-6.204],[106.85,-6.194],[106.839,-6.194],[106.839,-6.204]]]}};
    else if (path.endsWith("/insights")) data = {insight:"Rangkuman fixture untuk pengujian, bukan data publik.",generated_at:"2026-09-11T00:00:00Z"};
    else if (path.endsWith("/context")) data = {poi_count:3,poi_count_by_category:{kopi_minuman:2,warung_makan:1}};
    else if (path === "/reports/capabilities") data = {location:true,photo:true,route_feedback:true};
    else if (path.endsWith("/route-policy")) data = {graph_version:routingGraph.version,blocked_edge_ids:[],recommended_edge_ids:[]};
    else if (path.endsWith("/walking-graph")) {
      routeCalls++;
      if (failRoute) return route.fulfill({status:503,json:{error:"Fixture: rute gagal"}});
      data = routingGraph;
    }
    else if (path === "/reports") {
      submitted = route.request().postDataJSON();
      if (failReport) return route.fulfill({status:503,json:{error:"Fixture: layanan sementara gagal"}});
      data = {id:"qa-report",latitude:submitted.latitude,longitude:submitted.longitude,status:"pending"};
    }
    else return route.fulfill({status:404,json:{error:"Fixture endpoint not found: "+path}});
    return route.fulfill({status:data ? 200 : 404,json:data ?? {error:"Not found"}});
  });
}
try {
  for (const [name,options] of [["desktop",{viewport:{width:1512,height:982}}],["android",devices["Pixel 7"]]]) {
    const context = await browser.newContext(options);
    await fixtures(context);
    const page = await context.newPage();
    page.on("pageerror",e => errors.push(e.message));
    await page.goto("http://127.0.0.1:5174/#/insight");
    await page.getByLabel("Stasiun awal").selectOption("cikini");
    await page.getByRole("heading",{name:"Kawasan Stasiun Cikini"}).waitFor();
    await page.getByRole("heading",{name:/Rp\s*20[.,]000/}).waitFor();
    assert.match(await page.locator(".category-distribution").innerText(),/67%/);
    await page.screenshot({path:outputPath+"/"+name+"-insight.png",fullPage:true});
    await page.getByRole("link",{name:"Tempat",exact:true}).click();
    await page.getByLabel("Urutkan tempat").selectOption("price-desc");
    assert.match(await page.locator(".place-card").first().innerText(),/Warung Sore/);
    assert.match(await page.locator(".place-card").last().innerText(),/Kopi Tanpa Harga/);
    await page.getByLabel("Urutkan tempat").selectOption("price-asc");
    await page.locator(".place-detail-link").first().click();
    await page.getByRole("heading",{name:"Kopi Hemat",exact:true}).waitFor();
    await page.getByText("Kopi susu",{exact:true}).waitFor();
    await page.screenshot({path:outputPath+"/"+name+"-place.png",fullPage:true});
    await page.getByRole("button",{name:"Lihat rute",exact:true}).click();
    await page.locator(".route-summary").filter({hasText:"Fixture: rute gagal"}).waitFor();
    failRoute = false;
    await page.locator(".route-summary").getByRole("button",{name:"Coba lagi"}).click();
    await page.locator(".route-summary").filter({hasText:findRoute(routingGraph,from,to,[],[]).distance_m+" m"}).waitFor();
    assert.match(await page.locator(".insight-wrap").textContent(), /AI Station Insight/);
    assert.match(await page.locator(".insight-wrap").textContent(), /Tanya AI seputar stasiun ini[\s\S]*Segera hadir/);
    assert.match(await page.locator(".place-card").first().textContent(), /Data Terbuka/);
    assert.ok(routeCalls > 0);
    await page.getByRole("link",{name:"Laporkan jalur ↗"}).click();
    await page.locator(".report-map canvas").waitFor();
    await page.locator(".report-map canvas").click({position:{x:150,y:170}});
    await page.getByLabel("Saya memastikan titik ini adalah lokasi yang dilaporkan.").check();
    await page.locator(".report-map canvas").click({position:{x:180,y:190}});
    assert.equal(await page.getByLabel("Saya memastikan titik ini adalah lokasi yang dilaporkan.").isChecked(),false);
    await page.getByLabel("Saya memastikan titik ini adalah lokasi yang dilaporkan.").check();
    await page.locator(".report-form select").nth(1).selectOption("trotoar_rusak");
    await page.getByLabel("Ceritakan kondisi jalur").fill("Trotoar berlubang di titik ini.");
    await page.getByLabel("Tambah foto laporan").setInputFiles({name:"qa.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG7sAAAAASUVORK5CYII=","base64")});
    await page.getByAltText("Pratinjau foto laporan").waitFor();
    await page.screenshot({path:outputPath+"/"+name+"-report.png",fullPage:true});
    failReport = true;
    await page.getByRole("button",{name:"Kirim laporan",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Fixture: layanan sementara gagal"}).waitFor();
    assert.equal(await page.getByLabel("Ceritakan kondisi jalur").inputValue(),"Trotoar berlubang di titik ini.");
    assert.ok(Number.isFinite(submitted.latitude) && Number.isFinite(submitted.longitude));
    assert.ok(submitted.photo_url.startsWith("data:image/png;base64,"));
    const requestId = submitted.request_id;
    failReport = false;
    await page.getByRole("button",{name:"Kirim laporan",exact:true}).click();
    await page.getByRole("heading",{name:"Laporan berhasil dikirim."}).waitFor();
    assert.equal(submitted.request_id,requestId);
    await page.getByRole("link",{name:"Beranda",exact:true}).click();
    await page.getByText("TRANSITFIT AI · PRATINJAU BERANDA",{exact:true}).waitFor();
    for (const width of [360,393,412,768,1024]) {
      await page.setViewportSize({width,height:851});
      for (const destination of ["insight","tempat","lapor","beranda","map"]) {
        await page.goto("http://127.0.0.1:5174/#/"+destination);
        await page.waitForTimeout(150);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Overflow "+destination+" at "+width);
      }
    }
    await context.close();
    failRoute = true;
  }
  assert.deepEqual(errors,[]);
  console.log("PASS: desktop + Pixel 7, insight median/category distribution, price sorting null-last, place detail/menu, walking distance/path, report map pin/confirmation/error/retry/idempotency, navigation, responsive widths 360/393/412/768/1024. All API responses isolated fixtures; no public reports sent.");
} finally { await browser.close(); }

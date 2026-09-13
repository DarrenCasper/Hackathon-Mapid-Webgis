import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {api} from "../lib/apiClient";
import {MapCanvas} from "../components/map/MapCanvas";
import {RouteReportMap} from "../components/map/RouteReportMap";
import {useEffect} from "react";
import {useMap} from "../components/map/MapContext";

function ReviewCamera({coordinates}) {
  const map=useMap();
  useEffect(()=>{if(map && coordinates)map.jumpTo({center:coordinates,zoom:17});},[map,coordinates]);
  return null;
}
function Review({report,token}) {
  const [evidence,setEvidence]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const client=useQueryClient();
  const graph=useQuery({queryKey:["walking-graph",report.station_id],queryFn:()=>api.get(`/stations/${encodeURIComponent(report.station_id)}/walking-graph`),staleTime:300000});
  const mutation=useMutation({mutationFn:decision=>api.adminPost(`/admin/reports/${report.id}/route-decision`,{decision,evidence,confirmed_on_site:confirmed},token),onSuccess:async()=>{await client.invalidateQueries({queryKey:["admin-reports"]});await client.invalidateQueries({queryKey:["route-policy"]});}});
  const segments=(graph.data?.edges ?? []).filter(e=>report.route_edge_ids.includes(e.id)).map(e=>({edge_id:e.id,coordinates:[graph.data.nodes[e.from],graph.data.nodes[e.to]]}));
  const coordinates=segments[0]?.coordinates[0];
  const active=report.status==="applied";
  return <section className="surface admin-review"><span className="eyebrow">{report.route_feedback==="avoid"?"USULAN BLACKLIST RUAS":"USULAN REKOMENDASI RUAS"}</span><h2>{report.station?.name ?? report.station_id}</h2><p>{report.description}</p><p>Status: <strong>{report.status}</strong> · Jenis: {report.report_type}</p>
    <div className="admin-route-map"><MapCanvas><RouteReportMap segments={segments} selectedId={report.route_edge_ids[0]}/><ReviewCamera coordinates={coordinates}/></MapCanvas></div>
    {graph.error && <p role="alert">{graph.error.message}</p>}
    {report.photo_url && <img className="report-photo" alt="Bukti foto pelapor" src={report.photo_url}/>}
    <p>Pin pelapor: {report.latitude}, {report.longitude}</p>
    <ul>{report.route_edge_ids.map(id=><li key={id}>{id}</li>)}</ul>
    <label htmlFor="verification-evidence">Bukti pemeriksaan / alasan keputusan</label><textarea id="verification-evidence" minLength={10} maxLength={2000} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Tanggal pemeriksaan, kondisi yang ditemukan, dan referensi bukti."/>
    <label className="confirm-location"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Saya telah memverifikasi kondisi lapangan dengan bukti yang dapat dipertanggungjawabkan.</label>
    <p className="soft-note">Persetujuan memengaruhi rute publik. Blacklist mengalahkan rekomendasi pada ruas yang sama. Pencabutan hanya membatalkan keputusan laporan ini.</p>
    <div className="admin-actions">{["pending","verified"].includes(report.status) && <><button className="primary-action" disabled={!confirmed||evidence.trim().length<10||mutation.isPending||!segments.length||graph.data?.version!==report.route_graph_version} onClick={()=>mutation.mutate("approve")}>Setujui & terapkan</button><button className="secondary-action" disabled={evidence.trim().length<10||mutation.isPending} onClick={()=>mutation.mutate("reject")}>Tolak laporan</button></>}{active && <button className="secondary-action" disabled={evidence.trim().length<10||mutation.isPending} onClick={()=>mutation.mutate("revoke")}>Cabut keputusan</button>}</div>
    {mutation.error && <p role="alert" className="warning-note">{mutation.error.message}</p>}
    {mutation.isSuccess && <p role="status">Keputusan tersimpan. Kebijakan rute telah diperbarui.</p>}
    <details><summary>Riwayat keputusan</summary>{report.route_decisions?.map(d=><p key={d.id}>{new Date(d.created_at).toLocaleString("id-ID")} · {d.decision}: {d.evidence}</p>)}</details>
  </section>;
}
export function AdminRoutesPage() {
  const [token,setToken]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [status,setStatus]=useState("pending");
  const [selectedId,setSelectedId]=useState(null);
  const login=useMutation({mutationFn:()=>api.post("/admin/login",{email,password}),onSuccess:data=>{setToken(data.token);setPassword("");}});
  const reports=useQuery({queryKey:["admin-reports",status,token],queryFn:()=>api.adminGet(`/admin/reports?status=${status}`,token),enabled:Boolean(token),retry:false});
  const list=reports.data?.filter(r=>r.route_feedback) ?? [];
  const selected=list.find(r=>r.id===selectedId) ?? list[0];
  if(!token)return <main className="surface admin-login"><span className="eyebrow">MODERASI TRANSITFIT</span><h1>Masuk sebagai admin</h1><form onSubmit={e=>{e.preventDefault();login.mutate();}}><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary-action" disabled={login.isPending}>Masuk</button></form>{login.error&&<p role="alert">{login.error.message}</p>}</main>;
  return <main className="admin-layout"><aside className="surface"><h1>Verifikasi ruas</h1><button onClick={()=>{setToken("");}}>Keluar</button><label htmlFor="admin-status">Status laporan</label><select id="admin-status" value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">Menunggu</option><option value="applied">Aktif</option><option value="verified">Terverifikasi</option><option value="rejected">Ditolak / dicabut</option></select>{reports.isPending&&<p>Memuat laporan…</p>}{reports.error&&<p role="alert">{reports.error.message}<button onClick={()=>reports.refetch()}>Coba lagi</button></p>}{!reports.isPending&&!reports.error&&!list.length&&<p>Tidak ada laporan ruas pada status ini.</p>}{list.map(r=><button className="admin-report-item" aria-pressed={selected?.id===r.id} key={r.id} onClick={()=>setSelectedId(r.id)}>{r.station?.name ?? r.station_id}<small>{r.route_feedback==="avoid"?"Hindari ruas":"Rekomendasikan"} · {r.description.slice(0,90)}</small></button>)}</aside>{selected&&<Review key={selected.id} report={selected} token={token}/>}</main>;
}

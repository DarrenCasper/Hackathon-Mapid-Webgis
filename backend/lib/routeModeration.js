const prisma=require("../lib/db");
const asyncHandler=require("../middleware/asyncHandler");
function decisionError(body,report,graph) {
  if(!["approve","reject","revoke"].includes(body.decision))return "Keputusan tidak valid.";
  if(typeof body.evidence!=="string" || body.evidence.trim().length<10 || body.evidence.length>2000)return "Isi bukti/catatan pemeriksaan minimal 10 karakter.";
  if(!report.route_feedback || !report.route_edge_ids.length)return "Laporan ini bukan feedback ruas rute.";
  if(body.decision==="approve") {
    if(body.confirmed_on_site!==true)return "Konfirmasi pemeriksaan lapangan wajib.";
    if(!["pending","verified"].includes(report.status))return "Laporan sudah diputuskan.";
    if(!graph || graph.version!==report.route_graph_version || report.route_edge_ids.some(id=>!graph.data.edges.some(e=>e.id===id)))return "Graf ruas berubah. Laporan harus diperiksa dan dibuat ulang.";
  }
  if(body.decision==="reject" && !["pending","verified"].includes(report.status))return "Laporan sudah diputuskan; gunakan cabut keputusan.";
  if(body.decision==="revoke" && report.status!=="applied")return "Hanya keputusan aktif yang dapat dicabut.";
  return null;
}
function registerRouteModeration(router) {
  router.post("/reports/:id/route-decision",asyncHandler(async(req,res)=>{
    const outcome=await prisma.$transaction(async tx=>{
      const report=await tx.report.findUnique({where:{id:req.params.id}});
      if(!report)return {status:404,error:"Laporan tidak ditemukan."};
      const graph=await tx.walkingGraph.findUnique({where:{station_id:report.station_id}});
      const error=decisionError(req.body,report,graph);
      if(error)return {status:400,error};
      const approved=req.body.decision==="approve",time=new Date();
      const update=await tx.report.updateMany({where:{id:report.id,status:report.status},data:{status:approved?"applied":"rejected",moderator_id:req.moderator.moderator_id,moderator_note:req.body.evidence.trim(),verification_evidence:approved?req.body.evidence.trim():report.verification_evidence,verified_on_site_at:approved?time:report.verified_on_site_at,resolved_at:time}});
      if(update.count!==1)return {status:409,error:"Keputusan diubah moderator lain. Muat ulang laporan."};
      await tx.routeDecision.create({data:{report_id:report.id,moderator_id:req.moderator.moderator_id,decision:req.body.decision,evidence:req.body.evidence.trim()}});
      return {status:200,data:{id:report.id,status:approved?"applied":"rejected"}};
    });
    res.status(outcome.status).json(outcome.error?{error:outcome.error}:outcome.data);
  }));
}
module.exports={registerRouteModeration,decisionError};

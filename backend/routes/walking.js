const express=require("express");
const {rateLimit}=require("express-rate-limit");
const prisma=require("../lib/db");
const {loadGraph,routePolicy}=require("../lib/walkingGraph");
const asyncHandler=require("../middleware/asyncHandler");
const router=express.Router();
router.get("/stations/:id/walking-graph",rateLimit({windowMs:60000,limit:20,standardHeaders:"draft-7",legacyHeaders:false}),asyncHandler(async(req,res)=>{
  try {
    const graph=await loadGraph(req.params.id);
    res.json({...graph.data,version:graph.version,created_at:graph.created_at,station_id:graph.station_id});
  } catch(error) { if(error.status) return res.status(error.status).json({error:error.message}); throw error; }
}));
router.get("/stations/:id/route-policy",asyncHandler(async(req,res)=>{
  res.set("Cache-Control","no-store");
  const graph=await prisma.walkingGraph.findUnique({where:{station_id:req.params.id}});
  if(!graph) return res.status(409).json({error:"Graf jalan belum siap."});
  const reports=await prisma.report.findMany({where:{station_id:req.params.id,status:"applied",route_feedback:{not:null}},select:{id:true,status:true,route_edge_ids:true,route_feedback:true,verification_evidence:true,verified_on_site_at:true}});
  res.json({...routePolicy(reports,graph.data),graph_version:graph.version});
}));
module.exports=router;

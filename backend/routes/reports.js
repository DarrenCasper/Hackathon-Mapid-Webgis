const express = require("express");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../lib/db");
const asyncHandler = require("../middleware/asyncHandler");
const { validateReport } = require("../lib/reportValidation");
const { edgeDistance } = require("../lib/walkingGraph");
const router = express.Router();

// Readiness includes the migration, not just the version of the running server.
router.get("/capabilities", asyncHandler(async (req,res) => {
  await prisma.$queryRaw`SELECT latitude, longitude, request_id, route_edge_ids FROM "Report" LIMIT 0`;
  res.json({location:true,photo:true,route_feedback:true,max_photo_bytes:2097152});
}));
router.post("/",rateLimit({windowMs:60000,limit:5,standardHeaders:"draft-7",legacyHeaders:false}),asyncHandler(async (req,res) => {
  const error = validateReport(req.body);
  if (error) return res.status(400).json({error});
  const {station_id,poi_id,report_type,description,photo_url,latitude,longitude,request_id} = req.body;
  const {route_edge_ids,route_graph_version,route_feedback} = req.body;
  const data = {station_id,poi_id:poi_id ?? null,report_type,description:description.trim(),photo_url:photo_url ?? null,latitude,longitude,request_id,route_edge_ids:route_edge_ids ?? [],route_graph_version:route_graph_version ?? null,route_feedback:route_feedback ?? null};
  if (route_feedback != null) {
    if (!["avoid","recommend"].includes(route_feedback) || !Array.isArray(route_edge_ids) || route_edge_ids.length !== 1 || typeof route_edge_ids[0] !== "string") return res.status(400).json({error:"Pilih satu ruas untuk setiap laporan rute."});
    const graph = await prisma.walkingGraph.findUnique({where:{station_id}});
    if (!graph || graph.version !== route_graph_version || !graph.data.edges.some(e => e.id === route_edge_ids[0])) return res.status(409).json({error:"Ruas atau versi graf tidak cocok. Hitung ulang rute sebelum melapor."});
    if (edgeDistance(graph.data,route_edge_ids[0],[longitude,latitude])>75) return res.status(400).json({error:"Pin laporan harus berada dalam 75 m dari ruas yang dipilih."});
  } else if (route_graph_version != null || (route_edge_ids != null && (!Array.isArray(route_edge_ids) || route_edge_ids.length))) return res.status(400).json({error:"Jenis feedback rute wajib untuk laporan ruas."});
  try {
    // Unique request_id makes a retry safe after a lost HTTP response.
    const existing = await prisma.report.findUnique({where:{request_id}});
    if (existing) {
      if (Object.keys(data).some(key => JSON.stringify(existing[key]) !== JSON.stringify(data[key]))) return res.status(409).json({error:"ID laporan sudah digunakan dengan isi berbeda. Mulai laporan baru."});
      return res.json({id:existing.id,latitude:existing.latitude,longitude:existing.longitude,status:existing.status});
    }
    const report = await prisma.report.create({data});
    return res.status(201).json({id:report.id,latitude:report.latitude,longitude:report.longitude,status:report.status});
  } catch (err) {
    if (err.code === "P2003") return res.status(400).json({error:"Stasiun atau tempat laporan tidak ditemukan."});
    if (err.code === "P2002") return res.status(409).json({error:"Laporan sedang diproses. Coba kirim ulang untuk memeriksa hasilnya."});
    throw err;
  }
}));
module.exports = router;

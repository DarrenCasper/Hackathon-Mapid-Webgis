// Public route — no auth. Commuters submit reports anonymously, per the
// project's explicit scope boundary (no end-user accounts at all).
const express = require("express");
const prisma = require("../lib/db");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// Kept as an explicit list rather than importing Prisma's generated enum
// object, so the 400 error message can name the valid values directly
// without reaching into Prisma internals for it.
const REPORT_TYPES = [
  "trotoar_rusak",
  "akses_tertutup",
  "banjir",
  "penyeberangan_tidak_aman",
  "tempat_tutup",
  "umkm_baru",
  "info_lainnya",
];

// POST /api/reports
// Body: { station_id, poi_id? , report_type, description, photo_url? }
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { station_id, poi_id, report_type, description, photo_url } = req.body;

    // Basic shape/enum validation happens here, before ever touching the
    // DB — this is different from "does the referenced station/poi
    // exist," which is deliberately left to the real foreign key
    // constraint below rather than a redundant pre-check.
    if (!station_id || typeof station_id !== "string") {
      return res.status(400).json({ error: "station_id is required" });
    }
    if (!description || typeof description !== "string") {
      return res.status(400).json({ error: "description is required" });
    }
    if (!REPORT_TYPES.includes(report_type)) {
      return res.status(400).json({
        error: `report_type must be one of: ${REPORT_TYPES.join(", ")}`,
      });
    }
    if (poi_id !== undefined && poi_id !== null && typeof poi_id !== "number") {
      return res.status(400).json({ error: "poi_id must be a number if provided" });
    }

    try {
      const report = await prisma.report.create({
        data: {
          station_id,
          poi_id: poi_id ?? null,
          report_type,
          description,
          photo_url: photo_url ?? null,
        },
      });
      res.status(201).json(report);
    } catch (err) {
      // P2003 = foreign key constraint failed — station_id or poi_id
      // doesn't reference a real row. err.meta.field_name is Postgres's
      // constraint name (e.g. "Report_station_id_fkey (index)"), not a
      // clean column name — pull "station_id"/"poi_id" back out of it
      // rather than leak that raw constraint identifier to the client.
      if (err.code === "P2003") {
        const match = err.meta?.field_name?.match(/station_id|poi_id/);
        const field = match ? match[0] : "station_id/poi_id";
        return res.status(400).json({
          error: `Invalid reference: ${field} does not point to an existing record`,
        });
      }
      throw err; // anything else is a genuine unexpected error — let asyncHandler's next(err) reach the centralized handler
    }
  })
);

module.exports = router;

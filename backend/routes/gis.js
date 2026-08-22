// Public, read-only GIS routes: regions, stations, isochrones, POIs, and
// the aggregated "context" view. Nothing here needs auth — that starts
// in Phase 5 with /api/admin/*.
const express = require("express");
const prisma = require("../lib/db");
const asyncHandler = require("../middleware/asyncHandler");
const {
  VALID_ISOCHRONE_MINUTES,
  getStationOrNull,
  getIsochronePolygon,
  getPoisInIsochrone,
  serializePoi,
} = require("../lib/stations");

const router = express.Router();

// Parses and validates the `minutes` query param shared by the
// isochrone/pois/context routes below. Returns null (and has already
// sent the 400 response) if invalid, so callers just do
// `const minutes = parseMinutes(req, res); if (minutes === null) return;`
function parseMinutes(req, res) {
  const raw = req.query.minutes;
  const minutes = raw === undefined ? 10 : Number(raw);
  if (!VALID_ISOCHRONE_MINUTES.includes(minutes)) {
    res.status(400).json({
      error: `minutes must be one of ${VALID_ISOCHRONE_MINUTES.join(", ")}`,
    });
    return null;
  }
  return minutes;
}

// GET /api/health — confirms Express AND the DB connection are both
// alive. A plain 200-if-Express-boots health check would still report
// "healthy" during a DB outage, which defeats the point of a health
// check for a service whose only job is querying the DB.
router.get(
  "/health",
  asyncHandler(async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "connected" });
    } catch (err) {
      console.error("Health check DB query failed:", err);
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  })
);

// GET /api/regions — distinct region values. Only one region
// ("jakarta_timur") exists today, but this stays generic rather than
// hardcoding it, since the schema was explicitly designed to support
// more regions later.
router.get(
  "/regions",
  asyncHandler(async (req, res) => {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT region FROM "Station" ORDER BY region
    `;
    res.json(rows.map((r) => r.region));
  })
);

// GET /api/regions/:region/stations
router.get(
  "/regions/:region/stations",
  asyncHandler(async (req, res) => {
    const { region } = req.params;
    const rows = await prisma.$queryRaw`
      SELECT id, name, region, ST_AsGeoJSON(location) AS location_geojson
      FROM "Station"
      WHERE region = ${region}
      ORDER BY id
    `;
    // No stations for a region is a valid, empty list — not a 404. 404 is
    // reserved for "this specific station id doesn't exist" below.
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        region: r.region,
        location: JSON.parse(r.location_geojson),
      }))
    );
  })
);

// GET /api/stations/:id — station + its exits
router.get(
  "/stations/:id",
  asyncHandler(async (req, res) => {
    const station = await getStationOrNull(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Station not found: ${req.params.id}` });
    }

    // StationExit has no rows yet — no ingestion script populates it (not
    // part of any Phase 3 script). Returns [] honestly rather than
    // pretending exit data exists.
    const exitRows = await prisma.$queryRaw`
      SELECT id, label, ST_AsGeoJSON(location) AS location_geojson
      FROM "StationExit"
      WHERE station_id = ${req.params.id}
      ORDER BY id
    `;

    res.json({
      ...station,
      exits: exitRows.map((e) => ({
        id: e.id,
        label: e.label,
        location: JSON.parse(e.location_geojson),
      })),
    });
  })
);

// GET /api/stations/:id/isochrone?minutes=10
router.get(
  "/stations/:id/isochrone",
  asyncHandler(async (req, res) => {
    const minutes = parseMinutes(req, res);
    if (minutes === null) return;

    const station = await getStationOrNull(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Station not found: ${req.params.id}` });
    }

    const polygon = await getIsochronePolygon(req.params.id, minutes);
    if (!polygon) {
      return res.status(404).json({
        error: `No ${minutes}-minute isochrone found for station ${req.params.id}`,
      });
    }

    res.json({ station_id: req.params.id, minutes, polygon });
  })
);

// GET /api/stations/:id/pois?minutes=10
router.get(
  "/stations/:id/pois",
  asyncHandler(async (req, res) => {
    const minutes = parseMinutes(req, res);
    if (minutes === null) return;

    const station = await getStationOrNull(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Station not found: ${req.params.id}` });
    }

    // Check the isochrone actually exists before running the ST_Contains
    // join — otherwise "no isochrone generated for this minutes value"
    // and "isochrone exists but genuinely has 0 POIs" would both come
    // back as an indistinguishable empty array.
    const polygon = await getIsochronePolygon(req.params.id, minutes);
    if (!polygon) {
      return res.status(404).json({
        error: `No ${minutes}-minute isochrone found for station ${req.params.id}`,
      });
    }

    const pois = await getPoisInIsochrone(req.params.id, minutes);
    res.json(pois.map(serializePoi));
  })
);

// GET /api/stations/:id/context?minutes=10 — aggregated summary.
//
// Response shape (designed here — the brief referenced an "exact JSON
// example" that wasn't actually included in what I was given, so this
// isn't matching a spec, it's a fresh design; flag any changes you want):
//   {
//     station: { id, name, region },
//     minutes,
//     poi_count,
//     poi_count_by_category: { <PoiCategory>: n, ..., uncategorized: n },
//     price_distribution: { ekonomis, menengah, premium, unclassified }
//   }
// busy_hours_summary is deliberately omitted — there's no busy-hour data
// anywhere in the schema or seeded data yet (see build.md Phase 4 notes).
const POI_CATEGORIES = [
  "kopi_minuman",
  "quick_meal",
  "warung_makan",
  "bakery",
  "casual_dining",
  "hiburan",
];
const PRICE_TIERS = ["ekonomis", "menengah", "premium"];

router.get(
  "/stations/:id/context",
  asyncHandler(async (req, res) => {
    const minutes = parseMinutes(req, res);
    if (minutes === null) return;

    const station = await getStationOrNull(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Station not found: ${req.params.id}` });
    }

    const polygon = await getIsochronePolygon(req.params.id, minutes);
    if (!polygon) {
      return res.status(404).json({
        error: `No ${minutes}-minute isochrone found for station ${req.params.id}`,
      });
    }

    const pois = await getPoisInIsochrone(req.params.id, minutes);

    // Aggregated here in plain JS, not a giant SQL GROUP BY, per brief —
    // the dataset per station (tens of POIs) is far too small for this
    // to matter performance-wise, and it reads far more clearly than the
    // equivalent SQL would.
    const poi_count_by_category = Object.fromEntries(
      [...POI_CATEGORIES, "uncategorized"].map((c) => [c, 0])
    );
    const price_distribution = Object.fromEntries(
      [...PRICE_TIERS, "unclassified"].map((t) => [t, 0])
    );

    for (const poi of pois) {
      const categoryKey = poi.category ?? "uncategorized";
      poi_count_by_category[categoryKey]++;

      const priceKey = poi.price_tier ?? "unclassified";
      price_distribution[priceKey]++;
    }

    res.json({
      station: { id: station.id, name: station.name, region: station.region },
      minutes,
      poi_count: pois.length,
      poi_count_by_category,
      price_distribution,
    });
  })
);

module.exports = router;

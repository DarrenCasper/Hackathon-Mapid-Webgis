// Shared raw-SQL query helpers for anything touching Station/Isochrone/Poi
// geometry columns. Pulled out of routes/gis.js because GET
// /stations/:id/pois and GET /stations/:id/context both need "the POIs
// inside this station's isochrone" — writing that ST_Contains query
// twice would risk them drifting apart.
const prisma = require("./db");

// Only 10 and 15 minute isochrones actually exist (see build.md Phase 3/4
// notes — the brief's [5,10,15] doesn't match what generate-isochrones.js
// produces). Exported so routes/gis.js can validate against the same list
// instead of hardcoding it twice.
const VALID_ISOCHRONE_MINUTES = [10, 15];

async function getStationOrNull(stationId) {
  const rows = await prisma.$queryRaw`
    SELECT id, name, region, prev_station_id, next_station_id, ST_AsGeoJSON(location) AS location_geojson
    FROM "Station"
    WHERE id = ${stationId}
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    prev_station_id: row.prev_station_id,
    next_station_id: row.next_station_id,
    location: JSON.parse(row.location_geojson),
  };
}

async function getIsochronePolygon(stationId, minutes) {
  const rows = await prisma.$queryRaw`
    SELECT ST_AsGeoJSON(polygon) AS polygon_geojson
    FROM "Isochrone"
    WHERE station_id = ${stationId} AND minutes = ${minutes}
  `;
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].polygon_geojson);
}

// POIs whose location falls inside the given station's isochrone polygon.
// ST_Contains does the spatial filtering in the database — never fetch
// every Poi row and filter in JS, that doesn't use the GIST index and
// gets slower as the Poi table grows.
async function getPoisInIsochrone(stationId, minutes) {
  return prisma.$queryRaw`
    SELECT p.id, p.name, p.category, p.price_tier, p.source, p.verified_field,
           p.menu_utama, p.harga_rata_rata, p.jam_buka, p.jam_tutup, p.kondisi_tempat,
           ST_AsGeoJSON(p.location) AS location_geojson
    FROM "Poi" p
    JOIN "Isochrone" i ON i.station_id = ${stationId} AND i.minutes = ${minutes}
    WHERE ST_Contains(i.polygon, p.location)
    ORDER BY p.id
  `;
}

// Shared shape-normalizer: the raw query above returns location as a
// GeoJSON string (ST_AsGeoJSON's output type) — every route that returns
// POIs to a client should hand back parsed GeoJSON, not a string a
// frontend would have to JSON.parse itself.
function serializePoi(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category, // null = not yet classified, see schema.prisma comment
    price_tier: row.price_tier, // null = not yet set, see schema.prisma comment
    source: row.source,
    verified_field: row.verified_field,
    menu_utama: row.menu_utama,
    harga_rata_rata: row.harga_rata_rata,
    jam_buka: row.jam_buka,
    jam_tutup: row.jam_tutup,
    kondisi_tempat: row.kondisi_tempat,
    location: JSON.parse(row.location_geojson),
  };
}

const POI_CATEGORIES = [
  "kopi_minuman",
  "quick_meal",
  "warung_makan",
  "bakery",
  "casual_dining",
  "hiburan",
];
const PRICE_TIERS = ["ekonomis", "menengah", "premium"];

// Extracted from routes/gis.js's /context route (originally written
// inline there) when lib/generateStationInsight.js (Phase 9) needed the
// exact same aggregation — two call sites computing "POI count by
// category" independently would risk them drifting apart, same reason
// the geometry query helpers above are shared functions rather than
// copy-pasted SQL.
function aggregatePoiStats(pois) {
  const poi_count_by_category = Object.fromEntries(
    [...POI_CATEGORIES, "uncategorized"].map((c) => [c, 0])
  );
  const price_distribution = Object.fromEntries(
    [...PRICE_TIERS, "unclassified"].map((t) => [t, 0])
  );

  for (const poi of pois) {
    poi_count_by_category[poi.category ?? "uncategorized"]++;
    price_distribution[poi.price_tier ?? "unclassified"]++;
  }

  return { poi_count_by_category, price_distribution };
}

// Phase 9 change-detection: a station needs its AI insight regenerated
// if it's never been generated, OR if any POI inside its 15-min
// isochrone has been created/updated more recently than the insight
// was. Poi.updated_at is kept current by a DB trigger (see migration
// 20260823120000_poi_timestamps) regardless of which script wrote it,
// so this stays correct without every ingestion script needing to know
// about insight generation.
async function getStationsNeedingInsightRefresh() {
  const rows = await prisma.$queryRaw`
    SELECT s.id
    FROM "Station" s
    WHERE s.ai_insight IS NULL
       OR s.ai_insight_generated_at < (
         SELECT COALESCE(MAX(p.updated_at), '1970-01-01'::timestamp)
         FROM "Poi" p
         JOIN "Isochrone" i ON i.station_id = s.id AND i.minutes = 15
         WHERE ST_Contains(i.polygon, p.location)
       )
    ORDER BY s.id
  `;
  return rows.map((r) => r.id);
}

module.exports = {
  VALID_ISOCHRONE_MINUTES,
  POI_CATEGORIES,
  PRICE_TIERS,
  getStationOrNull,
  getIsochronePolygon,
  getPoisInIsochrone,
  serializePoi,
  aggregatePoiStats,
  getStationsNeedingInsightRefresh,
};

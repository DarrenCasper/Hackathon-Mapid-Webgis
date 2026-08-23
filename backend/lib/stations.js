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

module.exports = {
  VALID_ISOCHRONE_MINUTES,
  getStationOrNull,
  getIsochronePolygon,
  getPoisInIsochrone,
  serializePoi,
};

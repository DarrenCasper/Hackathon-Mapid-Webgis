// Fills the `hiburan` (entertainment) PoiCategory, which has had ZERO
// real POIs in it for this entire project — none of fetch-osm-fallback.js's
// 5 food-only tags map to it, and no MAPID mission has ever returned an
// entertainment-typed place either. Free, zero new setup (same Overpass
// API already used elsewhere), separate script from fetch-osm-fallback.js
// on purpose — entertainment coverage is a distinct concern from food
// coverage, so it shouldn't be gated behind "does this station already
// have enough food POIs" (a station could have 20 restaurants and 0
// entertainment options, or vice versa — the two thresholds shouldn't be
// coupled).
//
// Run standalone: node scripts/fetch-osm-entertainment.js
require("dotenv").config();
const prisma = require("../lib/db");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ISOCHRONE_MINUTES = 15;

// All map to 'hiburan' — this script only ever produces one category,
// unlike fetch-osm-fallback.js's multi-category table, since every tag
// here is some form of entertainment/leisure venue.
const ENTERTAINMENT_TAGS = [
  "amenity=cinema",
  "amenity=nightclub",
  "amenity=theatre",
  "leisure=bowling_alley",
  "leisure=amusement_arcade",
  "leisure=escape_game",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 8000;

async function getAllStationIsochrones() {
  return prisma.$queryRaw`
    SELECT s.id AS station_id, s.name AS station_name, ST_AsGeoJSON(i.polygon) AS polygon_geojson
    FROM "Station" s
    JOIN "Isochrone" i ON i.station_id = s.id AND i.minutes = ${ISOCHRONE_MINUTES}
    ORDER BY s.id
  `;
}

function polygonToOverpassPolyString(polygonGeoJSON) {
  const ring = JSON.parse(polygonGeoJSON).coordinates[0];
  return ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
}

function buildQuery(polyString) {
  const filters = ENTERTAINMENT_TAGS.map((tag) => {
    const [key, value] = tag.split("=");
    return `  node["${key}"="${value}"](poly:"${polyString}");\n  way["${key}"="${value}"](poly:"${polyString}");`;
  }).join("\n");
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout center;`;
}

async function fetchElements(polygonGeoJSON) {
  const query = buildQuery(polygonToOverpassPolyString(polygonGeoJSON));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "TransitFitAI/0.1 (Jakarta Timur KRL hackathon project)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    const text = await res.text();

    if (res.status === 429 && attempt < MAX_RETRIES) {
      console.warn(`  ⚠ rate-limited (attempt ${attempt}/${MAX_RETRIES}), waiting ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    if (!res.ok) throw new Error(`Overpass returned ${res.status}:\n${text}`);
    return JSON.parse(text).elements;
  }
}

function coordsForElement(element) {
  if (element.type === "node") return { lat: element.lat, lng: element.lon };
  if (element.center) return { lat: element.center.lat, lng: element.center.lon };
  return null;
}

async function isInsideIsochrone(polygonGeoJSON, lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT ST_Contains(
      ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJSON}), 4326),
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    ) AS contains
  `;
  return rows[0].contains;
}

// Case-insensitive, same reasoning as fetch-jakarta-opendata.js's dedup —
// don't assume a data source's casing is consistent.
async function alreadyExists(name, lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM "Poi"
    WHERE LOWER(name) = LOWER(${name})
      AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 30)
    LIMIT 1
  `;
  return rows.length > 0;
}

async function main() {
  const stations = await getAllStationIsochrones();
  let totalSaved = 0;

  for (const station of stations) {
    try {
      const elements = await fetchElements(station.polygon_geojson);
      let saved = 0;

      for (const element of elements) {
        const name = element.tags?.name?.trim();
        if (!name) continue;

        const coords = coordsForElement(element);
        if (!coords) continue;

        // Overpass's poly filter isn't guaranteed to match PostGIS's
        // ST_Contains exactly near boundaries — same real bug found and
        // fixed in fetch-osm-fallback.js this session, applying the same
        // fix here from the start rather than waiting to hit it again.
        if (!(await isInsideIsochrone(station.polygon_geojson, coords.lng, coords.lat))) continue;
        if (await alreadyExists(name, coords.lng, coords.lat)) continue;

        await prisma.$executeRaw`
          INSERT INTO "Poi" (name, category, location, source, verified_field)
          VALUES (
            ${name},
            'hiburan'::"PoiCategory",
            ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326),
            'openstreetmap'::"PoiSource",
            false
          )
        `;
        saved++;
      }

      totalSaved += saved;
      if (saved > 0) console.log(`  ✓ ${station.station_id} — ${station.station_name}: ${saved} entertainment POI(s)`);
    } catch (err) {
      console.error(`  ✗ ${station.station_id}:`, err.message);
    }

    await sleep(3000); // same Overpass spacing as fetch-osm-fallback.js
  }

  console.log(`Done. ${totalSaved} entertainment POI(s) saved across ${stations.length} stations.`);
}

main()
  .catch((err) => {
    console.error("Fatal error fetching entertainment POIs:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Coverage-gap fallback: for any station whose 15-minute isochrone has
// fewer than MIN_POI_COVERAGE real POIs (from resolve-pois.js), pull
// amenity data from OpenStreetMap's Overpass API to fill the gap. This
// is explicitly NOT the primary data path — run resolve-pois.js (and
// ideally classify-categories.js) first so this only fires for
// genuinely thin areas, not everywhere.
//
// Threshold chosen: 5. Reasoning: 3 options is really too few for a
// commuter to meaningfully compare ("real walking-distance food
// options" implies choice, not just "a" place); 5 is enough for a
// short list while still being low enough that stations with decent
// MAPID mission coverage won't trigger OSM fetching unnecessarily.
//
// Run standalone: node scripts/fetch-osm-fallback.js
require("dotenv").config();
const prisma = require("../lib/db");

const MIN_POI_COVERAGE = 5;
const ISOCHRONE_MINUTES = 15;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Simple, explicit lookup — not a guess-based classifier. Anything not
// in this table is skipped (logged), not force-mapped to a wrong
// category. "hiburan" has no OSM food/amenity equivalent, so it's never
// produced by this script.
const OSM_TAG_TO_CATEGORY = {
  "amenity=cafe": "kopi_minuman",
  "amenity=fast_food": "quick_meal",
  "amenity=restaurant": "casual_dining",
  "amenity=marketplace": "warung_makan",
  "shop=bakery": "bakery",
};

async function getStationsNeedingFallback() {
  // Count existing Poi rows already inside each station's 15-min
  // isochrone. ST_Contains does the real spatial filtering — no
  // fetch-everything-then-filter-in-JS here.
  return prisma.$queryRaw`
    SELECT s.id AS station_id, s.name AS station_name,
           ST_AsGeoJSON(i.polygon) AS polygon_geojson,
           COUNT(p.id) AS poi_count
    FROM "Station" s
    JOIN "Isochrone" i ON i.station_id = s.id AND i.minutes = ${ISOCHRONE_MINUTES}
    LEFT JOIN "Poi" p ON ST_Contains(i.polygon, p.location)
    GROUP BY s.id, s.name, i.polygon
    HAVING COUNT(p.id) < ${MIN_POI_COVERAGE}
    ORDER BY s.id
  `;
}

// Overpass's `poly` filter wants "lat lon lat lon ..." (lat first,
// unlike GeoJSON's [lon, lat]), space-separated, no wrapping quotes
// needed once interpolated into the query string.
function polygonToOverpassPolyString(polygonGeoJSON) {
  const ring = JSON.parse(polygonGeoJSON).coordinates[0];
  return ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
}

function buildOverpassQuery(polyString) {
  const tagFilters = Object.keys(OSM_TAG_TO_CATEGORY)
    .map((tag) => {
      const [key, value] = tag.split("=");
      return `  node["${key}"="${value}"](poly:"${polyString}");\n  way["${key}"="${value}"](poly:"${polyString}");`;
    })
    .join("\n");

  return `[out:json][timeout:25];\n(\n${tagFilters}\n);\nout center;`;
}

async function fetchOverpassElements(polygonGeoJSON) {
  const query = buildOverpassQuery(polygonToOverpassPolyString(polygonGeoJSON));

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass's server rejects requests with no/generic User-Agent as
      // likely bots (returns a bare Apache 406, not an Overpass error) —
      // confirmed by testing; a real UA is required, not optional.
      "User-Agent": "TransitFitAI/0.1 (Jakarta Timur KRL hackathon project)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  const text = await res.text();
  if (!res.ok) {
    // Per brief: show the raw response, don't silently work around it.
    throw new Error(`Overpass returned ${res.status}:\n${text}`);
  }

  const body = JSON.parse(text);
  return body.elements;
}

function categoryForTags(tags) {
  for (const [tagKey, category] of Object.entries(OSM_TAG_TO_CATEGORY)) {
    const [key, value] = tagKey.split("=");
    if (tags[key] === value) return category;
  }
  return null;
}

function coordsForElement(element) {
  // Nodes have lat/lon directly; ways/relations need `out center` output,
  // which Overpass puts under `.center`.
  if (element.type === "node") return { lat: element.lat, lng: element.lon };
  if (element.center) return { lat: element.center.lat, lng: element.center.lon };
  return null;
}

async function saveOsmPoi(name, lng, lat, category) {
  await prisma.$executeRaw`
    INSERT INTO "Poi" (name, category, location, source, verified_field)
    VALUES (
      ${name},
      ${category}::"PoiCategory",
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      'openstreetmap'::"PoiSource",
      false
    )
  `;
}

async function main() {
  const stations = await getStationsNeedingFallback();
  if (stations.length === 0) {
    console.log(
      `No stations below the ${MIN_POI_COVERAGE}-POI threshold — nothing to fetch from OSM.`
    );
    return;
  }

  let totalSaved = 0;

  for (const station of stations) {
    console.log(
      `${station.station_id} — ${station.station_name}: only ${station.poi_count} POI(s), fetching OSM fallback...`
    );

    try {
      const elements = await fetchOverpassElements(station.polygon_geojson);
      let saved = 0;
      let skippedNoName = 0;
      let skippedUnmapped = 0;

      for (const element of elements) {
        const tags = element.tags || {};
        const name = tags.name?.trim();
        if (!name) {
          skippedNoName++;
          continue;
        }

        const category = categoryForTags(tags);
        if (!category) {
          skippedUnmapped++;
          continue;
        }

        const coords = coordsForElement(element);
        if (!coords) continue;

        await saveOsmPoi(name, coords.lng, coords.lat, category);
        saved++;
      }

      totalSaved += saved;
      console.log(
        `  ✓ saved ${saved} OSM POI(s) (skipped ${skippedNoName} unnamed, ${skippedUnmapped} unmapped tags)`
      );
    } catch (err) {
      console.error(`  ✗ ${station.station_id}:`, err.message);
    }
  }

  console.log(`Done. ${totalSaved} OSM-sourced POI(s) saved.`);
}

main()
  .catch((err) => {
    console.error("Fatal error fetching OSM fallback data:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Primary data source (replaces what would otherwise be an OSM-only
// pipeline). For each station's 15-minute isochrone, fetches every
// approved MAPID mission (propertigo/menugo/struckgo) whose location
// falls inside that polygon, and stores each one verbatim in
// MapidMission. No cherry-picking of fields here — that happens later in
// resolve-pois.js — so nothing is lost if the schema needs a field later.
//
// Requires: Isochrone rows already exist (run generate-isochrones.js
// first) and MAPID_API_KEY set in .env.
//
// Run standalone: node scripts/fetch-mapid-missions.js
require("dotenv").config();
const prisma = require("../lib/db");

const MAPID_API_KEY = process.env.MAPID_API_KEY;
const MISSION_TYPES = ["propertigo", "menugo", "struckgo"];
const ISOCHRONE_MINUTES = 15; // per brief: missions are fetched against the 15-minute walk radius

async function getStationIsochrones() {
  // ST_AsGeoJSON gives us back exactly the {type, coordinates} shape
  // MAPID's `feature` field expects. PostGIS always closes polygon rings,
  // so the "first/last coordinate identical" requirement is automatic.
  return prisma.$queryRaw`
    SELECT s.id AS station_id, s.name AS station_name, ST_AsGeoJSON(i.polygon) AS polygon_geojson
    FROM "Station" s
    JOIN "Isochrone" i ON i.station_id = s.id
    WHERE i.minutes = ${ISOCHRONE_MINUTES}
    ORDER BY s.id
  `;
}

// One page of one mission type for one station. Returns the parsed body;
// throws with the raw response text on a non-200 so failures are never
// silent guesses.
async function fetchMissionPage(missionType, polygon, offset) {
  const res = await fetch(
    `https://server.mapid.io/web/competition/${missionType}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MAPID_API_KEY,
      },
      body: JSON.stringify({ feature: polygon, offset }),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MAPID ${missionType} returned ${res.status}:\n${text}`);
  }
  return JSON.parse(text);
}

async function fetchAllMissionsForPolygon(missionType, polygon) {
  const all = [];
  let offset = 0;

  while (true) {
    const page = await fetchMissionPage(missionType, polygon, offset);
    all.push(...page.features);

    // Pagination is fixed at limit=100 server-side; we just follow
    // hasMore rather than assuming a page size ourselves.
    if (!page.pagination?.hasMore || page.features.length === 0) break;
    offset += page.features.length;
  }

  return all;
}

async function saveMission(feature, missionType) {
  const [lng, lat] = feature.geometry.coordinates;
  await prisma.$executeRaw`
    INSERT INTO "MapidMission" (id, mission_type, location, raw_properties)
    VALUES (
      ${feature._id},
      ${missionType},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${JSON.stringify(feature.properties)}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      mission_type = EXCLUDED.mission_type,
      location = EXCLUDED.location,
      raw_properties = EXCLUDED.raw_properties
  `;
}

async function main() {
  if (!MAPID_API_KEY) {
    console.error("MAPID_API_KEY is not set in .env");
    process.exitCode = 1;
    return;
  }

  const stationIsochrones = await getStationIsochrones();
  if (stationIsochrones.length === 0) {
    console.error(
      `No ${ISOCHRONE_MINUTES}-minute isochrones found — run generate-isochrones.js first.`
    );
    process.exitCode = 1;
    return;
  }

  let totalSaved = 0;

  for (const row of stationIsochrones) {
    const polygon = JSON.parse(row.polygon_geojson);
    console.log(`${row.station_id} — ${row.station_name}`);

    for (const missionType of MISSION_TYPES) {
      try {
        const features = await fetchAllMissionsForPolygon(missionType, polygon);
        for (const feature of features) {
          await saveMission(feature, missionType);
        }
        totalSaved += features.length;
        console.log(`  ✓ ${missionType}: ${features.length} mission(s)`);
      } catch (err) {
        console.error(`  ✗ ${missionType}:`, err.message);
      }
    }
  }

  console.log(`Done. ${totalSaved} mission rows saved/updated.`);
}

main()
  .catch((err) => {
    console.error("Fatal error fetching MAPID missions:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

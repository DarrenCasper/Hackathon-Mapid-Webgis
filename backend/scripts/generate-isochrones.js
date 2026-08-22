// For each station, calls the local Valhalla container's /isochrone
// endpoint (pedestrian costing) for 10 and 15 minute walk times, and
// stores the resulting polygon in the Isochrone table.
//
// Requires Valhalla running first: `docker compose up` (see README.md
// "Valhalla setup" — you need to download a Jakarta .osm.pbf extract
// before this container will do anything useful).
//
// Run standalone: node scripts/generate-isochrones.js
require("dotenv").config();
const prisma = require("../lib/db");

const VALHALLA_URL = process.env.VALHALLA_URL || "http://localhost:8002";
const WALK_MINUTES = [10, 15]; // per brief — Phase 4's API also accepts 5,
// but we don't generate a 5-minute isochrone here. Flagged as a brief
// inconsistency, not silently resolved — see build.md.

async function getStations() {
  // Station.location is Unsupported(geometry) — ST_X/ST_Y pull lng/lat
  // back out as plain numbers for the Valhalla request body.
  return prisma.$queryRaw`
    SELECT id, name, ST_X(location) AS lng, ST_Y(location) AS lat
    FROM "Station"
    ORDER BY id
  `;
}

async function fetchIsochrone(lat, lng, minutes) {
  const res = await fetch(`${VALHALLA_URL}/isochrone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [{ lat, lon: lng }],
      costing: "pedestrian",
      contours: [{ time: minutes }],
      polygons: true,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    // Per brief: show the raw response, don't guess at what went wrong.
    throw new Error(
      `Valhalla returned ${res.status} for minutes=${minutes}:\n${text}`
    );
  }
  return JSON.parse(text);
}

// Valhalla can return a MultiPolygon (e.g. if the walkable area splits
// into disconnected chunks around a barrier). Our schema column is
// strictly geometry(Polygon, 4326), so a MultiPolygon can't go in as-is.
// We pick the largest ring by vertex count as a pragmatic stand-in and
// print the raw geometry so you can see exactly what was collapsed,
// rather than silently swallowing the difference.
function coercePolygon(geometry, stationId, minutes) {
  if (geometry.type === "Polygon") return geometry;

  if (geometry.type === "MultiPolygon") {
    console.warn(
      `  ⚠ ${stationId} (${minutes}min): Valhalla returned a MultiPolygon ` +
        `with ${geometry.coordinates.length} parts. Raw geometry:\n` +
        JSON.stringify(geometry) +
        `\n  Interpretation: keeping only the largest part (by ring point ` +
        `count) since the Isochrone.polygon column is Polygon-only.`
    );
    const largest = geometry.coordinates.reduce((a, b) =>
      a[0].length >= b[0].length ? a : b
    );
    return { type: "Polygon", coordinates: largest };
  }

  throw new Error(
    `Unexpected geometry type "${geometry.type}" for ${stationId} (${minutes}min): ` +
      JSON.stringify(geometry)
  );
}

async function main() {
  const stations = await getStations();
  if (stations.length === 0) {
    console.error("No stations found — run scripts/seed-stations.js first.");
    process.exitCode = 1;
    return;
  }

  for (const station of stations) {
    for (const minutes of WALK_MINUTES) {
      try {
        const geojson = await fetchIsochrone(station.lat, station.lng, minutes);
        const feature = geojson.features?.[0];
        if (!feature) {
          console.error(
            `  ✗ ${station.id} (${minutes}min): Valhalla response had no features:\n` +
              JSON.stringify(geojson)
          );
          continue;
        }

        const polygon = coercePolygon(feature.geometry, station.id, minutes);

        await prisma.$executeRaw`
          INSERT INTO "Isochrone" (station_id, minutes, polygon, method)
          VALUES (
            ${station.id},
            ${minutes},
            ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(polygon)}), 4326),
            'valhalla'
          )
          ON CONFLICT (station_id, minutes) DO UPDATE SET
            polygon = EXCLUDED.polygon,
            method = EXCLUDED.method,
            generated_at = now()
        `;
        console.log(`  ✓ ${station.id} (${minutes}min)`);
      } catch (err) {
        // Per brief: log clearly, don't fail the whole run silently for
        // one bad station — but do fail loudly so it's not missed.
        console.error(`  ✗ ${station.id} (${minutes}min):`, err.message);
      }
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Fatal error generating isochrones:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

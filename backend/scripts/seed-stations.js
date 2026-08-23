// Reads data/stations.geojson and inserts every station into the
// Station table. Originally just the 7 Jakarta Timur stations; expanded
// to the full Jabodetabek network (90 stations) with per-feature region
// and rough prev/next line-adjacency — see build.md Phase 7 for how that
// data was built and verified.
//
// Run standalone: node scripts/seed-stations.js
//
// Why $executeRaw here instead of prisma.station.create(): Station.location
// is declared Unsupported("geometry(Point, 4326)") in schema.prisma, so
// Prisma Client has no field for it — we build the point with PostGIS's
// ST_MakePoint/ST_SetSRID functions directly in SQL. Everything else
// (id, name, region, prev/next) could technically go through normal
// Prisma Client, but since the geometry column forces a raw query anyway,
// it's simpler to write the whole INSERT in one raw statement than split
// it in two.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const prisma = require("../lib/db");

async function main() {
  const geojsonPath = path.join(__dirname, "..", "data", "stations.geojson");
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));

  console.log(`Seeding ${geojson.features.length} stations from ${geojsonPath}...`);

  // Pass 1: insert/update every station with prev/next left NULL.
  // prev_station_id/next_station_id are self-referencing foreign keys —
  // inserting a station whose "next" points at a station not yet in the
  // table would fail the FK check. Two passes sidesteps ordering
  // entirely: every row exists before any cross-reference is set.
  for (const feature of geojson.features) {
    const { station_id, name, region } = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    await prisma.$executeRaw`
      INSERT INTO "Station" (id, name, region, location)
      VALUES (
        ${station_id},
        ${name},
        ${region},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        region = EXCLUDED.region,
        location = EXCLUDED.location
    `;
    console.log(`  ✓ ${station_id} — ${name}`);
  }

  // Pass 2: wire up prev/next now that every station row exists.
  console.log("Linking prev/next station adjacency...");
  for (const feature of geojson.features) {
    const { station_id, prev_station_id, next_station_id } = feature.properties;
    await prisma.$executeRaw`
      UPDATE "Station"
      SET prev_station_id = ${prev_station_id ?? null},
          next_station_id = ${next_station_id ?? null}
      WHERE id = ${station_id}
    `;
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to seed stations:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

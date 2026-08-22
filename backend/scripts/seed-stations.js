// Reads data/stations.geojson and inserts the 7 Jakarta Timur stations
// into the Station table.
//
// Run standalone: node scripts/seed-stations.js
//
// Why $executeRaw here instead of prisma.station.create(): Station.location
// is declared Unsupported("geometry(Point, 4326)") in schema.prisma, so
// Prisma Client has no field for it — we build the point with PostGIS's
// ST_MakePoint/ST_SetSRID functions directly in SQL. Everything else
// (id, name, region) could technically go through normal Prisma Client,
// but since the geometry column forces a raw query anyway, it's simpler
// to write the whole INSERT in one raw statement than split it in two.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const prisma = require("../lib/db");

async function main() {
  const geojsonPath = path.join(__dirname, "..", "data", "stations.geojson");
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));

  console.log(`Seeding ${geojson.features.length} stations from ${geojsonPath}...`);

  for (const feature of geojson.features) {
    const { station_id, name } = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    // ON CONFLICT DO UPDATE makes this safe to re-run (e.g. after editing
    // stations.geojson) without needing to manually clear the table first.
    await prisma.$executeRaw`
      INSERT INTO "Station" (id, name, region, location)
      VALUES (
        ${station_id},
        ${name},
        'jakarta_timur',
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        region = EXCLUDED.region,
        location = EXCLUDED.location
    `;
    console.log(`  ✓ ${station_id} — ${name}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to seed stations:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

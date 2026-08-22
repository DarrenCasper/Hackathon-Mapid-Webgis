// Clusters MapidMission rows into canonical Poi records: missions that
// share an exact nama_tempat AND sit within ~30m of each other are
// treated as the same real-world place (e.g. a menugo survey and a
// struckgo receipt-photo submitted for the same warung).
//
// category and price_tier are deliberately left NULL here — see the
// comment on the Poi model in schema.prisma. classify-categories.js
// (next script) fills in category; nothing sets price_tier yet.
//
// Idempotent by design: re-running this script re-matches missions to
// their existing Poi (same name, within 30m) instead of creating
// duplicates, so it's safe to run again after fetching more missions.
//
// Run standalone: node scripts/resolve-pois.js
require("dotenv").config();
const prisma = require("../lib/db");

const CLUSTER_RADIUS_METERS = 30;

// propertigo missions have no nama_tempat field at all (see MAPID API
// reference in build.md/the original brief — its properties are
// kategori_properti/jenis_properti/alamat, nothing name-like). Those are
// expected to fail clustering and get logged, not silently dropped.
async function getUnresolvedMissions() {
  return prisma.$queryRaw`
    SELECT id, mission_type, raw_properties, ST_AsGeoJSON(location) AS location_geojson
    FROM "MapidMission"
    ORDER BY id
  `;
}

async function findNearbyMatchingPoi(name, lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT id, menu_utama, harga_rata_rata, jam_buka, jam_tutup, kondisi_tempat, raw_category_text
    FROM "Poi"
    WHERE name = ${name}
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${CLUSTER_RADIUS_METERS}
      )
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function createPoi(name, lng, lat, source) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "Poi" (name, location, source)
    VALUES (
      ${name},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${source}::"PoiSource"
    )
    RETURNING id
  `;
  return rows[0].id;
}

// Fills in any of the 5 aggregated fields that are still empty on the
// Poi, using this mission's value — "whichever mission in the cluster
// has that field populated" per the brief, so first-populated wins and
// later missions in the same cluster don't clobber an existing value.
async function fillMissingFields(poiId, existing, properties) {
  const candidates = {
    menu_utama: properties.menu_utama,
    harga_rata_rata: properties.harga_rata_rata,
    jam_buka: properties.jam_buka,
    jam_tutup: properties.jam_tutup,
    kondisi_tempat: properties.kondisi_tempat,
    // raw_category_text: same "first non-empty wins" pattern as the
    // other aggregated fields above — classify-categories.js overwrites
    // Poi.category from this, but doesn't touch raw_category_text again.
    raw_category_text:
      properties.jenis_tempat ?? properties.kategori_tempat ?? properties.kategori_properti,
  };

  const updates = [];
  for (const [field, value] of Object.entries(candidates)) {
    if ((existing[field] === null || existing[field] === undefined) && value != null && value !== "") {
      updates.push({ field, value });
    }
  }
  if (updates.length === 0) return;

  // Built as individual UPDATEs rather than one dynamic SQL string —
  // keeps every value going through a parameterized $executeRaw call,
  // never string-concatenated into the query.
  for (const { field, value } of updates) {
    if (field === "menu_utama") {
      await prisma.$executeRaw`UPDATE "Poi" SET menu_utama = ${value} WHERE id = ${poiId}`;
    } else if (field === "harga_rata_rata") {
      await prisma.$executeRaw`UPDATE "Poi" SET harga_rata_rata = ${value} WHERE id = ${poiId}`;
    } else if (field === "jam_buka") {
      await prisma.$executeRaw`UPDATE "Poi" SET jam_buka = ${value} WHERE id = ${poiId}`;
    } else if (field === "jam_tutup") {
      await prisma.$executeRaw`UPDATE "Poi" SET jam_tutup = ${value} WHERE id = ${poiId}`;
    } else if (field === "kondisi_tempat") {
      await prisma.$executeRaw`UPDATE "Poi" SET kondisi_tempat = ${value} WHERE id = ${poiId}`;
    } else if (field === "raw_category_text") {
      await prisma.$executeRaw`UPDATE "Poi" SET raw_category_text = ${value} WHERE id = ${poiId}`;
    }
  }
}

async function linkMissionToPoi(missionId, poiId) {
  await prisma.$executeRaw`UPDATE "MapidMission" SET poi_id = ${poiId} WHERE id = ${missionId}`;
}

async function main() {
  const missions = await getUnresolvedMissions();
  if (missions.length === 0) {
    console.error("No MapidMission rows found — run fetch-mapid-missions.js first.");
    process.exitCode = 1;
    return;
  }

  let created = 0;
  let matched = 0;
  let skipped = 0;

  for (const mission of missions) {
    const properties = mission.raw_properties;
    const name = properties.nama_tempat?.trim();

    if (!name) {
      console.warn(
        `  ⚠ skipped mission ${mission.id} (${mission.mission_type}): no nama_tempat field`
      );
      skipped++;
      continue;
    }

    const [lng, lat] = JSON.parse(mission.location_geojson).coordinates;

    let poi = await findNearbyMatchingPoi(name, lng, lat);
    let poiId;

    if (poi) {
      poiId = poi.id;
      matched++;
    } else {
      poiId = await createPoi(name, lng, lat, "mapid_missions");
      poi = {
        menu_utama: null,
        harga_rata_rata: null,
        jam_buka: null,
        jam_tutup: null,
        kondisi_tempat: null,
        raw_category_text: null,
      };
      created++;
    }

    await fillMissingFields(poiId, poi, properties);
    await linkMissionToPoi(mission.id, poiId);
  }

  console.log(
    `Done. ${created} new Poi created, ${matched} missions matched to existing Poi, ${skipped} skipped (no name).`
  );
}

main()
  .catch((err) => {
    console.error("Fatal error resolving POIs:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

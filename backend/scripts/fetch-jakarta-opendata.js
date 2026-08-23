// Ingests Jakarta's official open data portal (satudata.jakarta.go.id)
// as a POI source, distinct from MAPID missions and OSM — see the
// PoiSource.jakarta_opendata comment in schema.prisma for why this
// needed its own enum value rather than reusing an existing one.
//
// Currently pulls one dataset: Perumda Pasar Jaya's market registry
// (292 markets across all 5 DKI Jakarta cities, real coordinates,
// addresses, phone numbers — verified live against the real API before
// building this, see build.md Phase 8). Unlike fetch-osm-fallback.js,
// this is NOT gated behind a "thin coverage" threshold — markets are a
// distinct category worth adding regardless of how many
// cafes/restaurants a station already has, per the project owner's
// "add as much data as you can" direction for this phase.
//
// Only markets that fall inside one of our stations' 15-min isochrones
// get inserted — the dataset covers all of DKI Jakarta, most of which
// is irrelevant to our specific 90-station network.
//
// Run standalone: node scripts/fetch-jakarta-opendata.js
require("dotenv").config();
const prisma = require("../lib/db");

const API_BASE = "https://ws.jakarta.go.id/gateway/DataPortalSatuDataJakarta/1.0/satudata";

// Each entry: { slug, category, nameField, latField, lngField }.
// category is a fixed PoiCategory, not inferred per-row — every row in
// a given dataset is the same kind of place, unlike OSM's tag-based
// per-element classification.
const DATASETS = [
  {
    slug: "data-lokasi-pasar-perusahaan-umum-daerah-perumda-pasar-jaya",
    label: "Perumda Pasar Jaya markets",
    category: "warung_makan", // traditional market, typically full of food stalls — same mapping fetch-osm-fallback.js already uses for amenity=marketplace
    nameField: "nama_pasar",
    latField: "koordinat_x", // field names are swapped vs. their actual meaning — verified against known Jakarta locations before trusting this
    lngField: "koordinat_y",
  },
];

async function fetchDataset(slug) {
  const res = await fetch(`${API_BASE}?kategori=dataset&tipe=detail&url=${slug}`, {
    headers: { "User-Agent": "TransitFitAI/0.1 (Jakarta Timur KRL hackathon project)" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`satudata.jakarta.go.id returned ${res.status} for ${slug}:\n${text}`);
  }
  const body = JSON.parse(text);
  return body.data;
}

// Same authoritative-boundary-check pattern as fetch-osm-fallback.js:
// don't trust a row is relevant just because we're choosing to fetch it —
// verify it's actually inside one of our isochrones via our own
// PostGIS geometry before inserting anything.
async function findContainingStation(lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT station_id FROM "Isochrone"
    WHERE minutes = 15 AND ST_Contains(polygon, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
    LIMIT 1
  `;
  return rows[0]?.station_id ?? null;
}

// Case-insensitive on purpose — the source dataset itself contains
// near-duplicate rows differing only in casing (e.g. "Pasar Mangga
// Besar" vs "PASAR MANGGA BESAR", confirmed directly: 47 of the first
// 105 rows ingested were exactly this kind of duplicate). A
// case-sensitive check would let every one of those through as if they
// were distinct places.
async function alreadyExists(name, lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM "Poi"
    WHERE LOWER(name) = LOWER(${name})
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        30
      )
    LIMIT 1
  `;
  return rows.length > 0;
}

async function main() {
  let totalSaved = 0;
  let totalSkippedOutside = 0;
  let totalSkippedDuplicate = 0;
  let totalSkippedBadCoord = 0;

  for (const dataset of DATASETS) {
    console.log(`Fetching ${dataset.label}...`);
    const rows = await fetchDataset(dataset.slug);
    console.log(`  got ${rows.length} rows`);

    for (const row of rows) {
      const name = row[dataset.nameField]?.trim();
      const lat = parseFloat(row[dataset.latField]);
      const lng = parseFloat(row[dataset.lngField]);

      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        totalSkippedBadCoord++;
        continue;
      }

      const stationId = await findContainingStation(lng, lat);
      if (!stationId) {
        totalSkippedOutside++;
        continue;
      }

      if (await alreadyExists(name, lng, lat)) {
        totalSkippedDuplicate++;
        continue;
      }

      await prisma.$executeRaw`
        INSERT INTO "Poi" (name, category, location, source, verified_field)
        VALUES (
          ${name},
          ${dataset.category}::"PoiCategory",
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
          'jakarta_opendata'::"PoiSource",
          true
        )
      `;
      totalSaved++;
      console.log(`  ✓ ${name} (near ${stationId})`);
    }
  }

  console.log(
    `Done. ${totalSaved} saved, ${totalSkippedOutside} outside any station's isochrone, ` +
      `${totalSkippedDuplicate} already existed, ${totalSkippedBadCoord} had missing/invalid name or coordinates.`
  );
}

main()
  .catch((err) => {
    console.error("Fatal error fetching Jakarta open data:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

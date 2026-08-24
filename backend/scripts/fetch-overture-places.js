// Phase 11 — Overture Maps Foundation as a POI source, replacing the
// earlier Google Places plan entirely. Google Places' own ToS only
// exempts `place_id` from long-term caching — everything else (name,
// category, coordinates) is barred from the "fetch once, store forever"
// pattern this project needs. Overture is the opposite: free, Apache
// 2.0 / CDLA Permissive, explicitly built for permanent local storage.
// Verified live against Overture's real schema before writing this
// (see build.md Phase 11) — notably, Overture's places theme has NO
// pricing/price field of any kind (confirmed via `DESCRIBE` against the
// live schema: id, geometry, categories, confidence, websites, emails,
// socials, phones, brand, addresses, names, sources, operating_status,
// basic_category, taxonomy, version, bbox, theme, type — nothing price-
// related). So this script cannot populate Poi.price_tier — that gap
// stays open; see build.md for what was checked before concluding that.
//
// Access: Overture publishes its data as cloud-hosted GeoParquet on a
// PUBLIC S3 bucket (s3://overturemaps-us-west-2), queried directly via
// DuckDB's spatial+httpfs extensions — no AWS account, no credentials,
// no cost. This is a genuinely different access pattern than every
// other script in this project (which use plain fetch() against a
// REST API) because Overture isn't distributed as a REST API at all.
//
// Run standalone: node scripts/fetch-overture-places.js
require("dotenv").config();
const { DuckDBInstance } = require("@duckdb/node-api");
const prisma = require("../lib/db");

const ISOCHRONE_MINUTES = 15;

// Overture's places theme uses a flat string taxonomy with 2,000+
// possible values (e.g. "indonesian_restaurant", "coffee_shop",
// "night_club" — confirmed via live sample query, see build.md). There's
// no way to enumerate all of them, but the food/drink/entertainment
// subset follows consistent naming conventions, so this is still an
// explicit lookup rather than a guess-based classifier: every suffix
// below was chosen because it's a known Overture category pattern, and
// anything that doesn't match is skipped (logged), never force-mapped.
//
// Checked in this order on purpose: drink-shop suffixes are checked
// before the generic "bar" suffix so "juice_bar" doesn't get caught by
// the hiburan "_bar" check.
const KOPI_MINUMAN_SUFFIXES = ["coffee_shop", "cafe", "tea_room", "bubble_tea_shop", "juice_bar", "smoothie_shop"];
const BAKERY_SUFFIXES = [
  "bakery", "pastry_shop", "dessert_shop", "ice_cream_shop", "donut_shop", "cake_shop",
  // Confirmed via a real run (see build.md Phase 11): Overture uses these
  // as bare category strings, not "_shop"-suffixed — first run logged
  // them as unmapped (372/278/269 occurrences respectively), so this
  // list was corrected against real observed data, not guessed upfront.
  "cupcake_shop", "desserts", "donuts",
];
const QUICK_MEAL_SUFFIXES = ["fast_food_restaurant", "fast_food", "food_truck", "food_stand", "food_court"];
const WARUNG_SUFFIXES = ["street_food", "food_stall"];
const HIBURAN_SUFFIXES = [
  "night_club", "bar", "pub", "karaoke_bar", "cinema", "movie_theater", "movie_theatre",
  "bowling_alley", "arcade", "amusement_park", "billiards", "theme_park", "escape_game",
  // Same real-run correction as BAKERY_SUFFIXES above (320/155/69
  // occurrences respectively) — bare category strings, not suffixed.
  "karaoke", "dance_club", "theatre", "theater",
];
const CASUAL_DINING_EXTRA_SUFFIXES = ["steakhouse", "buffet", "bistro", "diner", "eatery"];

// Matches the exact category, or the category as a suffix after an
// underscore (e.g. "japanese_restaurant" matches suffix "restaurant" but
// "barbershop" does NOT match suffix "bar" — no underscore boundary).
function matchesAnySuffix(category, suffixes) {
  return suffixes.some((suffix) => category === suffix || category.endsWith(`_${suffix}`));
}

function categoryForOverturePlace(rawCategory) {
  if (!rawCategory) return null;
  const c = rawCategory.toLowerCase();

  if (matchesAnySuffix(c, KOPI_MINUMAN_SUFFIXES)) return "kopi_minuman";
  if (matchesAnySuffix(c, BAKERY_SUFFIXES)) return "bakery";
  if (matchesAnySuffix(c, QUICK_MEAL_SUFFIXES)) return "quick_meal";
  if (matchesAnySuffix(c, WARUNG_SUFFIXES)) return "warung_makan";
  if (matchesAnySuffix(c, HIBURAN_SUFFIXES)) return "hiburan";
  if (c === "restaurant" || c.endsWith("_restaurant") || matchesAnySuffix(c, CASUAL_DINING_EXTRA_SUFFIXES)) {
    return "casual_dining";
  }
  return null;
}

// Broad, deliberately over-inclusive net for the S3-side prefilter —
// false positives here just mean a few extra rows get fetched and then
// rejected by categoryForOverturePlace() above (the real, precise
// filter). Keeping this filter at the DuckDB/SQL layer avoids pulling
// every hospital/school/shop in Jabodetabek across the wire.
const CATEGORY_PREFILTER_TERMS = [
  "restaurant", "cafe", "coffee", "bakery", "pastry", "dessert", "ice_cream", "donut", "cake",
  "bar", "pub", "club", "karaoke", "cinema", "theater", "theatre", "bowling", "arcade",
  "amusement", "billiard", "food", "eatery", "diner", "bistro", "buffet", "steakhouse",
  "tea_room", "juice", "smoothie",
];

const MIN_CONFIDENCE = 0.4; // lenient floor — Overture's own docs say confidence isn't calibrated across providers, so this is a noise floor, not a precision target. Real filtering happens via category mapping + isochrone containment below.

async function getLatestReleasePath(conn) {
  const reader = await conn.runAndReadAll("SELECT latest FROM 'https://stac.overturemaps.org/catalog.json'");
  const [{ latest }] = reader.getRowObjects();
  return `s3://overturemaps-us-west-2/release/${latest}/theme=places/type=place/*`;
}

// Isochrones (not raw station points) define the true search area — a
// single bbox covering all 90 stations' 15-min isochrones, computed
// from our own PostGIS data so it's never out of sync with the actual
// network (unlike a hardcoded Jabodetabek bounding box).
async function getSearchBbox() {
  const rows = await prisma.$queryRaw`
    SELECT
      MIN(ST_XMin(polygon)) AS xmin, MAX(ST_XMax(polygon)) AS xmax,
      MIN(ST_YMin(polygon)) AS ymin, MAX(ST_YMax(polygon)) AS ymax
    FROM "Isochrone" WHERE minutes = ${ISOCHRONE_MINUTES}
  `;
  return rows[0];
}

async function fetchOverturePlaces(bbox) {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  await conn.run("INSTALL spatial;");
  await conn.run("LOAD spatial;");
  await conn.run("INSTALL httpfs;");
  await conn.run("LOAD httpfs;");
  await conn.run("SET s3_region='us-west-2';");

  const parquetGlob = await getLatestReleasePath(conn);
  console.log(`Querying Overture release: ${parquetGlob}`);

  const categoryFilter = CATEGORY_PREFILTER_TERMS.map((term) => `categories.primary ILIKE '%${term}%'`).join(" OR ");

  const sql = `
    SELECT
      id,
      names.primary AS name,
      categories.primary AS category,
      confidence,
      operating_status,
      ST_X(geometry) AS lng,
      ST_Y(geometry) AS lat
    FROM read_parquet('${parquetGlob}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ${bbox.xmin} AND ${bbox.xmax}
      AND bbox.ymin BETWEEN ${bbox.ymin} AND ${bbox.ymax}
      AND confidence >= ${MIN_CONFIDENCE}
      AND (operating_status IS NULL OR operating_status = 'open')
      AND names.primary IS NOT NULL
      AND (${categoryFilter})
  `;
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects();
}

// Same authoritative-boundary-check pattern as every other ingestion
// script: Overture's own bbox column is a coarse prefilter, not proof a
// point is actually inside one of our isochrones — verify against our
// own PostGIS geometry before treating it as in-scope.
async function findContainingStation(lng, lat) {
  const rows = await prisma.$queryRaw`
    SELECT station_id FROM "Isochrone"
    WHERE minutes = ${ISOCHRONE_MINUTES} AND ST_Contains(polygon, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
    LIMIT 1
  `;
  return rows[0]?.station_id ?? null;
}

// Case-insensitive, cross-source: checks against every existing Poi
// regardless of which source added it, so Overture doesn't re-add a
// place MAPID/OSM/Jakarta opendata already captured under a slightly
// different casing.
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

async function savePoi(name, lng, lat, category, rawCategory) {
  await prisma.$executeRaw`
    INSERT INTO "Poi" (name, category, location, source, verified_field, raw_category_text)
    VALUES (
      ${name},
      ${category}::"PoiCategory",
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      'overture_maps'::"PoiSource",
      false,
      ${rawCategory}
    )
  `;
}

async function main() {
  const bbox = await getSearchBbox();
  console.log(
    `Search bbox: lng ${bbox.xmin.toFixed(4)} to ${bbox.xmax.toFixed(4)}, lat ${bbox.ymin.toFixed(4)} to ${bbox.ymax.toFixed(4)}`
  );

  const places = await fetchOverturePlaces(bbox);
  console.log(`Overture returned ${places.length} candidate place(s) after bbox + category + confidence prefiltering.`);

  let saved = 0;
  let skippedNoCategory = 0;
  let skippedOutsideIsochrone = 0;
  let skippedDuplicate = 0;
  const unmappedCategories = new Map(); // category string -> count, reported at the end so nothing is silently dropped without visibility

  for (const place of places) {
    const category = categoryForOverturePlace(place.category);
    if (!category) {
      skippedNoCategory++;
      unmappedCategories.set(place.category, (unmappedCategories.get(place.category) || 0) + 1);
      continue;
    }

    const stationId = await findContainingStation(place.lng, place.lat);
    if (!stationId) {
      skippedOutsideIsochrone++;
      continue;
    }

    if (await alreadyExists(place.name, place.lng, place.lat)) {
      skippedDuplicate++;
      continue;
    }

    await savePoi(place.name, place.lng, place.lat, category, place.category);
    saved++;
    if (saved % 50 === 0) console.log(`  ...${saved} saved so far`);
  }

  console.log(
    `\nDone. ${saved} saved, ${skippedOutsideIsochrone} outside any station's 15-min isochrone, ` +
      `${skippedDuplicate} already existed, ${skippedNoCategory} had an unmapped category.`
  );

  if (unmappedCategories.size > 0) {
    const top = [...unmappedCategories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`\nTop unmapped categories (not in our lookup table, skipped honestly rather than guessed):`);
    for (const [cat, count] of top) console.log(`  ${cat}: ${count}`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error fetching Overture places:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

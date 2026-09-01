// Phase 11 addendum — derives Poi.price_tier from Poi.harga_rata_rata
// (average price in rupiah), the one real price data this project has.
// Overture Maps was checked directly against its live schema and
// confirmed to carry no pricing field at all (see build.md Phase 11) —
// harga_rata_rata only exists on mapid_missions-sourced rows (real
// field-survey data), so this only ever touches that subset. POIs with
// no harga_rata_rata are left price_tier = null — never guessed from
// category, source, or anything else.
//
// One explicit, targeted data correction before bucketing: a single row
// ("Bubur Ayam Sunda") has harga_rata_rata = 20, which is implausible
// for any food item and sits completely outside the rest of the real
// distribution (next-lowest real value is 5,000) — almost certainly a
// dropped-zero entry error from the original MAPID survey submission
// (20 -> 20,000). Corrected by exact name + old-value match, not a
// blanket "round up tiny values" heuristic, so it can never silently
// alter a legitimately cheap item later.
//
// Thresholds (rupiah), chosen against the real observed spread (see
// build.md Phase 11 for the full sorted list): most real values cluster
// 5,000-20,000 (street food/cafe range), a middle band 20,000-35,000,
// and a handful above that (including one 180,000 catering-style
// outlier). ekonomis < 15,000, menengah 15,000-34,999, premium >= 35,000.
//
// Idempotent: only updates rows where price_tier IS NULL, so re-running
// never overwrites a value someone set by hand (e.g. future moderator
// correction).
//
// Run standalone: node scripts/backfill-price-tier.js
require("dotenv").config();
const prisma = require("../lib/db");

const EKONOMIS_MAX = 15000; // < this = ekonomis
const MENENGAH_MAX = 35000; // < this = menengah, >= this = premium

async function fixKnownDataEntryError() {
  const result = await prisma.$executeRaw`
    UPDATE "Poi" SET harga_rata_rata = 20000
    WHERE name = 'Bubur Ayam Sunda' AND harga_rata_rata = 20
  `;
  if (result > 0) console.log(`Corrected ${result} row(s): harga_rata_rata 20 -> 20000 (dropped-zero entry error).`);
}

async function backfillPriceTier() {
  const result = await prisma.$executeRaw`
    UPDATE "Poi"
    SET price_tier = (
      CASE
        WHEN harga_rata_rata < ${EKONOMIS_MAX} THEN 'ekonomis'
        WHEN harga_rata_rata < ${MENENGAH_MAX} THEN 'menengah'
        ELSE 'premium'
      END
    )::"PriceTier"
    WHERE harga_rata_rata IS NOT NULL AND price_tier IS NULL
  `;
  console.log(`Backfilled price_tier on ${result} row(s).`);
}

async function reportDistribution() {
  const rows = await prisma.$queryRaw`
    SELECT price_tier, COUNT(*) as total FROM "Poi" WHERE price_tier IS NOT NULL GROUP BY price_tier
  `;
  console.log("Current price_tier distribution:", rows);
}

async function main() {
  await fixKnownDataEntryError();
  await backfillPriceTier();
  await reportDistribution();
}

main()
  .catch((err) => {
    console.error("Fatal error backfilling price_tier:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

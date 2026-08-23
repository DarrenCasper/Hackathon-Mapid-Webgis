// Generates the Phase 9 AI "what to expect" text and stores it in
// Station.ai_insight. Three modes:
//   node scripts/generate-station-insights.js               → only stations
//                                                               whose data
//                                                               changed since
//                                                               their last
//                                                               insight (or
//                                                               never had one)
//   node scripts/generate-station-insights.js <station_id>  → force that
//                                                               one station
//   node scripts/generate-station-insights.js --force-all   → force every
//                                                               station,
//                                                               regardless
//                                                               of staleness
//
// The no-args default is deliberately "only stale" rather than "all 90" —
// see lib/scheduleInsightRefresh.js and build.md Phase 9 for the cost
// reasoning (blindly regenerating all 90 daily would be a meaningful
// chunk of this project's API budget for mostly-unchanged output).
// --force-all exists for when you actually want a full refresh (e.g.
// after a prompt change).
//
// COST NOTE: this calls a paid API, once per station processed.
require("dotenv").config();
const prisma = require("../lib/db");
const { generateAndSaveInsight } = require("../lib/generateStationInsight");
const { getStationsNeedingInsightRefresh } = require("../lib/stations");

async function getTargetStationIds() {
  const arg = process.argv[2];

  if (arg === "--force-all") {
    const rows = await prisma.$queryRaw`SELECT id FROM "Station" ORDER BY id`;
    return rows.map((r) => r.id);
  }
  if (arg) return [arg]; // explicit station_id — always force, ignores staleness

  return getStationsNeedingInsightRefresh();
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in .env");
    process.exitCode = 1;
    return;
  }

  const stationIds = await getTargetStationIds();
  if (stationIds.length === 0) {
    console.log("No stations need a refresh — every insight is already up to date.");
    return;
  }

  console.log(
    `Generating insights for ${stationIds.length} station(s) via claude-haiku-4-5 — ` +
      `this makes ${stationIds.length} API call(s).`
  );

  let succeeded = 0;
  let failed = 0;

  for (const stationId of stationIds) {
    try {
      const insight = await generateAndSaveInsight(stationId);
      succeeded++;
      console.log(`  ✓ ${stationId}: ${insight.slice(0, 80)}${insight.length > 80 ? "…" : ""}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${stationId}:`, err.message);
    }
  }

  console.log(`Done. ${succeeded} generated, ${failed} failed.`);
}

main()
  .catch((err) => {
    console.error("Fatal error generating station insights:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

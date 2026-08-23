// Phase 9's daily refresh: runs once a day inside the already-running
// server process (no separate cron job or Coolify scheduled-task feature
// needed — this works identically regardless of hosting platform).
// Deliberately calls getStationsNeedingInsightRefresh() rather than
// regenerating all 90 stations unconditionally — see build.md Phase 9
// and the header comment on scripts/generate-station-insights.js for the
// cost reasoning (blind daily regeneration of everything would be a
// meaningful chunk of this project's API budget for mostly-unchanged
// output).
const cron = require("node-cron");
const { getStationsNeedingInsightRefresh } = require("./stations");
const { generateAndSaveInsight } = require("./generateStationInsight");

async function runRefresh() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[insight-refresh] ANTHROPIC_API_KEY not set, skipping scheduled refresh.");
    return;
  }

  const staleIds = await getStationsNeedingInsightRefresh();
  if (staleIds.length === 0) {
    console.log("[insight-refresh] No stations need a refresh today.");
    return;
  }

  console.log(`[insight-refresh] Refreshing ${staleIds.length} station(s): ${staleIds.join(", ")}`);
  let succeeded = 0;
  let failed = 0;

  for (const stationId of staleIds) {
    try {
      await generateAndSaveInsight(stationId);
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[insight-refresh] ${stationId} failed:`, err.message);
    }
  }

  console.log(`[insight-refresh] Done. ${succeeded} refreshed, ${failed} failed.`);
}

// 03:00 server time, once daily — an arbitrary off-peak hour, chosen
// only so it doesn't coincide with likely traffic; not meaningful
// beyond that.
function scheduleInsightRefresh() {
  cron.schedule("0 3 * * *", () => {
    runRefresh().catch((err) => console.error("[insight-refresh] Fatal error:", err));
  });
  console.log("[insight-refresh] Daily refresh scheduled (03:00 server time).");
}

module.exports = { scheduleInsightRefresh, runRefresh };

// Shared "gather this station's real data as an AI-prompt-ready text
// block" logic — extracted from generateStationInsight.js when Phase 10
// (chatbot) needed the exact same station data the Phase 9 insight
// generator already builds. Two different AI features grounding
// themselves in independently-assembled data would risk the chatbot and
// the cached insight disagreeing about the same station.
const {
  getStationOrNull,
  getIsochronePolygon,
  getPoisInIsochrone,
  aggregatePoiStats,
} = require("./stations");

const CONTEXT_MINUTES = 15; // richest radius, same convention used throughout Phase 3's ingestion scripts
const MAX_SAMPLE_NAMES = 12; // enough for the model to ground specific mentions without ballooning the prompt

async function buildStationContext(stationId) {
  const station = await getStationOrNull(stationId);
  if (!station) {
    throw new Error(`Station not found: ${stationId}`);
  }

  const polygon = await getIsochronePolygon(stationId, CONTEXT_MINUTES);
  if (!polygon) {
    throw new Error(`No ${CONTEXT_MINUTES}-minute isochrone found for station ${stationId}`);
  }

  const pois = await getPoisInIsochrone(stationId, CONTEXT_MINUTES);
  const { poi_count_by_category, price_distribution } = aggregatePoiStats(pois);
  const sampleNames = pois.slice(0, MAX_SAMPLE_NAMES).map((p) => p.name);

  const text = `Station: ${station.name} (region: ${station.region})

POI counts by category (within ${CONTEXT_MINUTES} minutes walking):
${Object.entries(poi_count_by_category)
  .map(([cat, count]) => `- ${cat}: ${count}`)
  .join("\n")}

Price distribution:
${Object.entries(price_distribution)
  .map(([tier, count]) => `- ${tier}: ${count}`)
  .join("\n")}

Total POIs found: ${pois.length}

Sample of actual place names found nearby (not exhaustive):
${sampleNames.length > 0 ? sampleNames.map((n) => `- ${n}`).join("\n") : "(none)"}`;

  return { station, pois, poi_count_by_category, price_distribution, text };
}

module.exports = { buildStationContext, CONTEXT_MINUTES };

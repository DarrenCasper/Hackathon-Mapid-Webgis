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
  getStationIncidents,
} = require("./stations");

const CONTEXT_MINUTES = 15; // richest radius, same convention used throughout Phase 3's ingestion scripts
const MAX_SAMPLE_NAMES = 12; // enough for the model to ground specific mentions without ballooning the prompt
const MAX_INCIDENTS = 5; // recent-first cap, same reasoning as MAX_SAMPLE_NAMES — enough to ground real mentions without ballooning the prompt

// Same Indonesian labels frontend/src/api/useReports.js shows a
// commuter when they file a report — kept in sync by hand since this is
// backend code and can't import a frontend file; a mismatch here would
// only affect how the AI phrases a report type, not any real behavior.
const REPORT_TYPE_LABELS = {
  trotoar_rusak: "Trotoar rusak",
  akses_tertutup: "Akses tertutup",
  banjir: "Banjir",
  penyeberangan_tidak_aman: "Penyeberangan tidak aman",
  tempat_tutup: "Tempat tutup",
  umkm_baru: "UMKM baru",
  info_lainnya: "Info lainnya",
};

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
  const incidents = await getStationIncidents(stationId, MAX_INCIDENTS);

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
${sampleNames.length > 0 ? sampleNames.map((n) => `- ${n}`).join("\n") : "(none)"}

Reports near this station confirmed real by a moderator (most recent first — this is NOT an exhaustive incident log, only what's been reported and verified):
${
  incidents.length > 0
    ? incidents
        .map((r) => `- [${REPORT_TYPE_LABELS[r.report_type] ?? r.report_type}] ${r.description} (${r.created_at.toISOString().slice(0, 10)})`)
        .join("\n")
    : "(none reported/verified so far)"
}`;

  return { station, pois, poi_count_by_category, price_distribution, incidents, text };
}

module.exports = { buildStationContext, CONTEXT_MINUTES };

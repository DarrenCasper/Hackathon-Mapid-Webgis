// Phase 9 — generates the AI "what to expect" text for one station.
// Pure function: fetches the station's real data, calls Claude once,
// returns the text. Does NOT write to the DB itself — callers
// (scripts/generate-station-insights.js, the admin regenerate route)
// decide when/whether to persist the result, keeping this reusable in
// both places without duplicating the generation logic itself.
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const prisma = require("./db");
const { buildStationContext } = require("./buildStationContext");

const MODEL = "claude-haiku-4-5"; // same reasoning as classify-categories.js — bounded, structured-ish generation, not deep reasoning, doesn't justify a pricier model

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "..", "ai", "station-insight-prompt.md"),
  "utf-8"
);

async function generateStationInsight(stationId) {
  const { text: userMessage } = await buildStationContext(stationId);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude response had no text content");
  }
  return textBlock.text.trim();
}

// Generate + persist in one call — used identically by
// scripts/generate-station-insights.js, the admin regenerate route, and
// the daily refresh scheduler (lib/scheduleInsightRefresh.js), so the
// UPDATE statement lives in exactly one place rather than three.
async function generateAndSaveInsight(stationId) {
  const insight = await generateStationInsight(stationId);
  await prisma.$executeRaw`
    UPDATE "Station"
    SET ai_insight = ${insight}, ai_insight_generated_at = now()
    WHERE id = ${stationId}
  `;
  return insight;
}

module.exports = { generateStationInsight, generateAndSaveInsight };

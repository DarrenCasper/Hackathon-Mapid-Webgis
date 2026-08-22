// Normalizes the freeform category strings stored on Poi.raw_category_text
// (originally jenis_tempat / kategori_tempat / kategori_properti — a
// human typed these, so a plain switch statement would miss endless
// spelling/phrasing variants) into the fixed PoiCategory enum, using a
// zero-shot classification call to Claude.
//
// raw_category_text is never overwritten — only Poi.category is set.
// That preserves the original source string permanently, per brief.
//
// COST NOTE: this calls a paid API, once per unclassified Poi row. Not
// batched across rows into one call, since PoiCategory forcing via tool
// use needs one clean decision per item and this dataset is small
// (tens of rows, not thousands) — sequential calls are simple and the
// cost difference vs. batching is negligible at this scale.
//
// Model: Haiku 4.5, not a larger model — this is a short, fully-
// structured classification against a fixed 6-value enum (forced via
// tool use), not open-ended reasoning, so the cheapest current model is
// the right fit rather than over-paying for capability this task
// doesn't use. Still a one-line constant to bump up if classification
// quality turns out to need it.
//
// Run standalone: node scripts/classify-categories.js
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const prisma = require("../lib/db");

const MODEL = "claude-haiku-4-5";

const CATEGORY_DESCRIPTIONS = `
- kopi_minuman: coffee/drinks-focused place (kedai kopi, warkop yang jual minuman, jus, boba, angkringan minuman)
- quick_meal: fast/quick-service food (fast food chain, gerobak/kaki lima makanan cepat saji, warteg cepat saji)
- warung_makan: small traditional eatery or market stall selling cooked meals (warung makan, warteg, pasar makanan)
- bakery: bread/pastry shop (toko roti, bakery, kue)
- casual_dining: sit-down restaurant (restoran, rumah makan/RM dengan tempat duduk)
- hiburan: entertainment venue, not food (karaoke, bioskop, billiard, game center)
`.trim();

const CLASSIFY_TOOL = {
  name: "classify_poi",
  description:
    "Classify a place into exactly one PoiCategory based on a freeform Indonesian description of its type.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: [
          "kopi_minuman",
          "quick_meal",
          "warung_makan",
          "bakery",
          "casual_dining",
          "hiburan",
        ],
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "low if the description is ambiguous, generic (e.g. just 'Warung/Tenda' with no further detail), or could plausibly fit more than one category",
      },
    },
    required: ["category", "confidence"],
  },
};

async function getUnclassifiedPois() {
  return prisma.$queryRaw`
    SELECT id, name, raw_category_text
    FROM "Poi"
    WHERE category IS NULL AND raw_category_text IS NOT NULL AND raw_category_text != ''
    ORDER BY id
  `;
}

async function classify(anthropic, rawCategoryText, poiName) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    tool_choice: { type: "tool", name: "classify_poi" },
    tools: [CLASSIFY_TOOL],
    messages: [
      {
        role: "user",
        content:
          `Categories:\n${CATEGORY_DESCRIPTIONS}\n\n` +
          `Place name: "${poiName}"\n` +
          `Freeform type description (Indonesian): "${rawCategoryText}"\n\n` +
          `Classify this place into exactly one category.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  return toolUse.input; // { category, confidence }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in .env");
    process.exitCode = 1;
    return;
  }

  const pois = await getUnclassifiedPois();
  if (pois.length === 0) {
    console.log("No unclassified Poi rows with a raw_category_text found — nothing to do.");
    return;
  }

  console.log(
    `Classifying ${pois.length} Poi row(s) via ${MODEL} — this makes ${pois.length} API call(s).`
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let classified = 0;
  let lowConfidence = 0;

  for (const poi of pois) {
    try {
      const { category, confidence } = await classify(
        anthropic,
        poi.raw_category_text,
        poi.name
      );

      await prisma.$executeRaw`
        UPDATE "Poi" SET category = ${category}::"PoiCategory" WHERE id = ${poi.id}
      `;
      classified++;

      if (confidence === "low") {
        lowConfidence++;
        console.warn(
          `  ⚠ low confidence: Poi ${poi.id} "${poi.name}" ("${poi.raw_category_text}") → ${category}`
        );
      } else {
        console.log(`  ✓ Poi ${poi.id} "${poi.name}" → ${category} (${confidence})`);
      }
    } catch (err) {
      console.error(`  ✗ Poi ${poi.id} "${poi.name}":`, err.message);
    }
  }

  console.log(
    `Done. ${classified}/${pois.length} classified, ${lowConfidence} flagged low-confidence for manual review.`
  );
}

main()
  .catch((err) => {
    console.error("Fatal error classifying categories:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

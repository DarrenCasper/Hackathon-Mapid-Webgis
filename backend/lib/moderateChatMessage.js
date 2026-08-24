// Phase 10 — the injection/off-topic guard in front of the real chatbot.
// Cheap OpenAI model (gpt-5.4-mini) makes a fast pass/fail decision on
// the user's LATEST message only (not the full conversation — keeps
// this call small and focused) before a Claude Haiku call ever happens.
//
// Failure mode is deliberately FAIL CLOSED: if this call itself errors
// (network issue, OpenAI outage, bad key), the message is BLOCKED, not
// silently allowed through unguarded. The whole point of this module is
// a safety/cost gate — letting messages through unguarded exactly when
// the gate itself is broken would defeat it. The tradeoff: a real
// OpenAI outage takes the chatbot down too, not just the guard. Deemed
// acceptable for this project's scale — flag if that tradeoff should
// go the other way.
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const MODEL = "gpt-5.4-mini";

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "..", "ai", "chat-guard-prompt.md"),
  "utf-8"
);

const GUARD_SCHEMA = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    reason: { type: "string", description: "Brief reason for the decision, one sentence." },
  },
  required: ["allowed", "reason"],
  additionalProperties: false,
};

// Returns { allowed: boolean, reason: string }. Throws only for
// programmer error (missing API key) — a genuine API-call failure is
// caught internally and returns { allowed: false, reason: "..." }
// rather than propagating, so callers always get a clean decision
// object, never have to separately handle "the guard itself broke".
async function moderateChatMessage(userMessage) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "guard_decision",
          schema: GUARD_SCHEMA,
          strict: true,
        },
      },
    });

    const decision = JSON.parse(response.output_text);
    return decision;
  } catch (err) {
    console.error("[chat-guard] OpenAI call failed, failing closed:", err.message);
    return {
      allowed: false,
      reason: "The safety check is temporarily unavailable, so this message could not be processed.",
    };
  }
}

module.exports = { moderateChatMessage };

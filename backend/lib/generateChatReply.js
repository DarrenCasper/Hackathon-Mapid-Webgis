// Phase 10 — the real chat reply generator, called only AFTER
// lib/moderateChatMessage.js has already allowed the latest message.
// Stateless by design: the caller (routes/gis.js's chat route) passes
// the full conversation history on every call; nothing is persisted
// server-side. Matches this project's explicit no-end-user-accounts
// scope boundary — there's no natural place to attach a stored
// conversation to without inventing an identity system this project
// was never supposed to have.
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { buildStationContext } = require("./buildStationContext");

const MODEL = "claude-haiku-4-5"; // same reasoning as the insight generator and classify-categories.js

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "..", "ai", "station-chat-prompt.md"),
  "utf-8"
);

// messages: [{ role: "user" | "assistant", content: string }, ...],
// ending with the latest user message (already guard-checked by the
// caller — this function doesn't re-run the guard).
async function generateChatReply(stationId, messages) {
  const { text: stationContextText } = await buildStationContext(stationId);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Station data is fixed for the whole conversation, so it's cheapest
  // and simplest to fold it into the system prompt fresh on every call
  // rather than re-sending it as a message — the system prompt isn't
  // part of the "messages" the model treats as conversation turns.
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: `${SYSTEM_PROMPT}\n\n---\n\nStation data for this conversation:\n\n${stationContextText}`,
    messages,
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude response had no text content");
  }
  return textBlock.text.trim();
}

module.exports = { generateChatReply };

// Phase 10 — the chatbot route. Public, no auth (matches the rest of
// this app's no-end-user-accounts scope), but rate-limited — unlike
// Phase 9's cached /insights route, every call here triggers at least
// one live AI call (the guard) and possibly two (guard + Haiku reply),
// so this route has no natural cost ceiling without one.
const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const { getStationOrNull } = require("../lib/stations");
const { moderateChatMessage } = require("../lib/moderateChatMessage");
const { generateChatReply } = require("../lib/generateChatReply");

const router = express.Router();

// Per-IP: 20 messages per 15 minutes. Generous enough for a real
// back-and-forth conversation, low enough to bound worst-case cost from
// a single abusive client. Picked as a reasonable default, not tuned
// against real traffic (none exists yet) — revisit once this is live.
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat messages from this IP — please wait a few minutes and try again." },
});

// POST /api/stations/:id/chat
// Body: { messages: [{ role: "user" | "assistant", content: string }, ...] }
// Stateless — the caller resends the full conversation on every
// request, ending with the newest user message. Nothing is persisted
// server-side (see lib/generateChatReply.js for why).
router.post(
  "/stations/:id/chat",
  chatRateLimit,
  asyncHandler(async (req, res) => {
    const station = await getStationOrNull(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Station not found: ${req.params.id}` });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }
    for (const m of messages) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
        return res.status(400).json({
          error: 'each message must be { role: "user" | "assistant", content: string }',
        });
      }
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return res.status(400).json({ error: "the last message must have role \"user\"" });
    }

    // Guard runs on the latest message only — see
    // lib/moderateChatMessage.js for why (keeps the guard call small,
    // and it fails closed on its own errors, so this never throws).
    const decision = await moderateChatMessage(lastMessage.content);
    if (!decision.allowed) {
      return res.json({ allowed: false, reason: decision.reason, reply: null });
    }

    const reply = await generateChatReply(req.params.id, messages);
    res.json({ allowed: true, reply });
  })
);

module.exports = router;

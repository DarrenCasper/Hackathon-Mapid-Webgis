// Moderator-only routes. POST /login is the one route in this file that
// must stay open (it's what issues the token) — every route registered
// AFTER the router.use(requireAuth) call below is gated by it.
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/db");
const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const { generateAndSaveInsight } = require("../lib/generateStationInsight");

const router = express.Router();

const REPORT_STATUSES = ["pending", "verified", "rejected", "applied"];

// POST /api/admin/login
// Body: { email, password } -> { token }
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const moderator = await prisma.moderator.findUnique({ where: { email } });

    // Deliberately the same error for "no such email" and "wrong
    // password" — telling an attacker which one was wrong lets them
    // enumerate valid moderator emails.
    const invalidCredentials = () =>
      res.status(401).json({ error: "Invalid email or password" });

    if (!moderator) return invalidCredentials();

    const passwordMatches = await bcrypt.compare(password, moderator.password_hash);
    if (!passwordMatches) return invalidCredentials();

    const token = jwt.sign(
      { moderator_id: moderator.id, email: moderator.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // hackathon moderator tool — a week is a reasonable balance between not re-logging-in constantly and not issuing forever-valid tokens
    );

    res.json({ token });
  })
);

// Everything below this line requires a valid JWT.
router.use(requireAuth);

// GET /api/admin/reports?status=pending
router.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !REPORT_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${REPORT_STATUSES.join(", ")}`,
      });
    }

    // Plain Prisma Client `include` — per brief, this works fine for the
    // Station/Poi relations even though Station.location is an
    // Unsupported geometry column. Prisma just omits that one field from
    // the nested object; it doesn't error or need a raw query here,
    // because we're not filtering/computing on the geometry itself.
    const reports = await prisma.report.findMany({
      where: status ? { status } : undefined,
      include: { station: true, poi: true, moderator: true },
      orderBy: { created_at: "desc" },
    });

    res.json(reports);
  })
);

// POST /api/admin/reports/:id/verify
// Body: { status: "verified" | "rejected", moderator_note? }
router.post(
  "/reports/:id/verify",
  asyncHandler(async (req, res) => {
    const { status, moderator_note } = req.body;
    if (status !== "verified" && status !== "rejected") {
      return res.status(400).json({ error: 'status must be "verified" or "rejected"' });
    }

    try {
      const report = await prisma.report.update({
        where: { id: req.params.id },
        data: {
          status,
          moderator_note: moderator_note ?? null,
          moderator_id: req.moderator.moderator_id,
          resolved_at: new Date(),
        },
      });
      res.json(report);
    } catch (err) {
      // P2025 = Prisma's "record to update not found"
      if (err.code === "P2025") {
        return res.status(404).json({ error: `Report not found: ${req.params.id}` });
      }
      throw err;
    }
  })
);

// POST /api/admin/stations/:id/regenerate-insight
// Moderator-only, live-calls Claude for exactly this one station and
// updates the cached Station.ai_insight — the deliberate escape hatch
// for "this station's data changed, refresh its insight now" without
// needing shell/SSH access to run scripts/generate-station-insights.js.
// Gated behind requireAuth specifically because it's the one place in
// this app where a request triggers a paid API call — never exposed
// publicly (see the public GET /api/stations/:id/insights route in
// routes/gis.js, which only ever reads the cached value).
router.post(
  "/stations/:id/regenerate-insight",
  asyncHandler(async (req, res) => {
    let insight;
    try {
      insight = await generateAndSaveInsight(req.params.id);
    } catch (err) {
      if (err.message.startsWith("Station not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.startsWith("No 15-minute isochrone found")) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }

    res.json({ station_id: req.params.id, insight, generated_at: new Date() });
  })
);

module.exports = router;

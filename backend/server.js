// Entry point for the TransitFit AI API.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// CORS: controlled by ALLOWED_ORIGIN, defaulting to wide open ("*") when
// that var isn't set — which is exactly the case for local dev right
// now, since it's not in .env yet. Once the frontend has a real deployed
// URL, set ALLOWED_ORIGIN to it in Coolify's dashboard (see README
// "Coolify deployment" section) — that's a config change, not a code
// change, so nobody has to remember to come back and edit this file
// once the frontend domain exists.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));

app.use(morgan("dev")); // request logging to stdout
app.use(express.json()); // parse JSON request bodies (needed for POST /api/reports, /api/admin/*)

app.use("/api", require("./routes/gis"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api", require("./routes/chat"));

// Fallback for any route not matched above.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler — every route's errors land here via
// asyncHandler's next(err) (see middleware/asyncHandler.js). Logs the
// full error server-side but never leaks raw Prisma/Postgres error
// details (stack traces, table/column names, connection strings) to the
// client — those are exactly the kind of internals an error message
// shouldn't expose.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TransitFit AI API listening on port ${PORT}`);
});

// Runs inside this same process — see lib/scheduleInsightRefresh.js for
// why (works identically on any host, no separate cron/Coolify feature
// needed) and why it's change-aware rather than a blind daily
// regeneration of all 90 stations (cost).
require("./lib/scheduleInsightRefresh").scheduleInsightRefresh();

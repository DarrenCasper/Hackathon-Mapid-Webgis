// Entry point for the TransitFit AI API.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// CORS: controlled by ALLOWED_ORIGIN, a comma-separated list of allowed
// origins (e.g. "https://mapid.darrencasper.com,http://localhost:5173")
// — a list, not a single string, because frontend/.env points
// VITE_API_BASE_URL at the PRODUCTION API even during local dev (see
// frontend/.env.example), so locking this down to only the deployed
// frontend domain would break `npm run dev` on localhost too. Falls
// back to wide open ("*") when unset, which is only true for local dev
// right now — set ALLOWED_ORIGIN for real in Coolify's dashboard (see
// README "Coolify deployment" section) to actually lock this down in
// production; that's a config change, not a code change.
const allowedOrigins = (process.env.ALLOWED_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes("*") ? "*" : allowedOrigins }));

app.use(morgan("dev")); // request logging to stdout
app.use(express.json({limit:"3mb"})); // includes an optional report photo (maximum 2 MB binary)

app.use("/api", require("./routes/gis"));
app.use("/api", require("./routes/walking"));
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
  if (err.type === "entity.too.large") return res.status(413).json({error:"Foto terlalu besar. Maksimal 2 MB."});
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

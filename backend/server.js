// Entry point for the TransitFit AI API.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// CORS: wide open for local dev. Once this API has a real Coolify URL and
// the frontend is deployed somewhere fixed, replace `origin: "*"` below
// with `origin: "https://your-frontend-domain"` — see README "Coolify
// deployment" section for why this can't stay wide open in production.
app.use(cors({ origin: "*" }));

app.use(morgan("dev")); // request logging to stdout
app.use(express.json()); // parse JSON request bodies (needed for POST /api/reports, /api/admin/*)

app.use("/api", require("./routes/gis"));
// Mounted in Phase 5:
//   app.use("/api/reports", require("./routes/reports"));
//   app.use("/api/admin", require("./routes/admin"));

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

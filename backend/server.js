// Entry point for the TransitFit AI API.
//
// Phase 1 note: routes are added in later phases (Phase 4 = public GIS
// routes, Phase 5 = reports/admin). Right now this just proves the server
// boots, is reachable, and is wired to the pieces (cors, morgan, dotenv)
// every later route will rely on.
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

// Routes are mounted here starting in Phase 4, e.g.:
//   app.use("/api", require("./routes/gis"));
//   app.use("/api/reports", require("./routes/reports"));
//   app.use("/api/admin", require("./routes/admin"));

// Fallback for any route not yet implemented — keeps behavior predictable
// while routes/ is still empty.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler (expanded in Phase 4 to turn Prisma/Postgres
// errors into clean 4xx responses instead of leaking raw error output).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TransitFit AI API listening on port ${PORT}`);
});

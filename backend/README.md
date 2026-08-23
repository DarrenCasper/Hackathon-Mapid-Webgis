# TransitFit AI — Backend

API for a WebGIS that shows KRL commuters real walking-distance food options
around 7 Jakarta Timur train stations. Node.js + Express + PostgreSQL/PostGIS
(via Prisma) + Valhalla for pedestrian isochrones.

This README is written to be read, not skimmed — it explains *why* things
are set up the way they are, not just the commands to run.

## Project structure

```
backend/
  data/         static seed data (stations.geojson)
  lib/db.js     Prisma client singleton — every route/script imports this,
                nobody does `new PrismaClient()` themselves
  middleware/   Express middleware (JWT auth guard, error handling)
  prisma/       schema.prisma + migrations/
  routes/       Express route handlers, mounted in server.js
  scripts/      one-off / cron-able data pipeline scripts, run via
                `node scripts/x.js` — these are NOT API routes
  server.js     Express app entry point
  docker-compose.yml   Valhalla routing container only (see below)
```

## Prerequisites

- Node.js 20+ and npm
- Docker (for the Valhalla routing container)
- A `.env` file (copy `.env.example` → `.env` and fill in real values —
  `.env` is gitignored, never commit it)

Install dependencies:

```bash
npm install
```

## The database is NOT started by this project

`DATABASE_URL` in `.env` points at a PostgreSQL + PostGIS instance that is
**already running** as a separate Coolify-managed resource on the server.
This repo never starts, containers, or provisions Postgres itself — there
is deliberately no `postgres` service in `docker-compose.yml`. Prisma just
connects to whatever `DATABASE_URL` says.

## Why Prisma needs raw SQL for geometry columns

Prisma's schema language has no native `geometry` type. Columns like
`Station.location` are declared in `schema.prisma` as:

```prisma
location  Unsupported("geometry(Point, 4326)")
```

`Unsupported(...)` tells Prisma "this column exists, include it in
migrations, but don't generate any JS API for reading/writing it normally."
That means:

- `prisma.station.findMany()` works fine for every *normal* column (`id`,
  `name`, `region`), but the `location` field will not come back usefully
  through the regular Prisma Client API.
- Any query that reads, writes, or filters on a geometry column has to be
  written by hand as raw SQL, using Prisma's `$queryRaw` / `$executeRaw`
  **tagged template literals** (never `$queryRawUnsafe` or string
  concatenation — that's how you get SQL injection). PostGIS functions do
  the real work: `ST_MakePoint`, `ST_SetSRID`, `ST_AsGeoJSON`,
  `ST_Contains`, `ST_DWithin`, etc.
- Everything *around* the geometry — foreign keys, enums, relations,
  `include` — still works through normal Prisma Client calls. You'll see
  this split throughout the codebase: e.g. `GET /api/admin/reports` uses a
  plain `prisma.report.findMany({ include: { station: true } })`, while
  `GET /api/stations/:id/pois` uses `$queryRaw` with `ST_Contains` because
  it's filtering on geometry.

`4326` is the SRID (spatial reference ID) for plain latitude/longitude
(WGS 84) — the same coordinate system GPS and GeoJSON use. Every geometry
column in this schema is `4326` so distances/contains checks between
tables are always comparing apples to apples.

## Valhalla setup (pedestrian isochrones)

Valhalla is the routing engine used in Phase 3
(`scripts/generate-isochrones.js`) to compute real walking-distance
polygons around each station (not just straight-line buffers). It runs as
a local Docker container, separate from Coolify, separate from Postgres.

1. Download a Jakarta OSM extract from Geofabrik. The smallest extract
   that reliably covers all 7 Jakarta Timur stations plus their 15-minute
   walk radius is the Jakarta-specific extract (fall back to the whole
   Indonesia/Java extract only if the small one 404s — Geofabrik's URLs
   for city-level extracts shift over time):

   https://download.geofabrik.de/asia/indonesia.html

   Look for a "Jakarta" or "DKI Jakarta" `.osm.pbf` sub-extract on that
   page. If none exists, download `java.osm.pbf` instead — bigger file,
   longer tile-build time, but guaranteed to contain Jakarta Timur.

2. Place the downloaded file here, renamed exactly to match
   `docker-compose.yml`:

   ```
   backend/valhalla/custom_files/jakarta.osm.pbf
   ```

   (create the `valhalla/custom_files/` folders if they don't exist yet —
   they're gitignored-by-absence, i.e. not committed, since the .pbf file
   is large)

3. Start the container:

   ```bash
   docker compose up
   ```

   On first boot Valhalla builds routing tiles from the .pbf file into
   the same `valhalla/custom_files/` folder — this can take several
   minutes depending on extract size. Subsequent `docker compose up` runs
   reuse the built tiles and start almost instantly, because the folder
   is bind-mounted (not an internal container volume that disappears on
   `docker compose down`).

4. Once it's up, Valhalla listens on `http://localhost:8002` (matches
   `VALHALLA_URL` in `.env.example`). `scripts/generate-isochrones.js`
   (Phase 3) POSTs to its `/isochrone` endpoint with `costing=pedestrian`.

### Where Valhalla actually runs (current state, not just setup steps)

The steps above are for setting this up from scratch on a new machine.
As of Phase 3, **Valhalla already runs persistently on the `casper`
server** (the same box that hosts the database) rather than on any one
developer's laptop — the ~1hr first-boot tile build only needs to happen
once, ever, not per-developer. `.env`'s `VALHALLA_URL` points at the
server's Tailscale IP (`http://100.101.248.124:8002`), reachable over a
direct (non-relayed) Tailscale connection with no extra firewall config
needed. You only need to redo the local Docker setup above if you're
setting up an entirely fresh Valhalla instance somewhere new — day to
day, nothing needs to run locally for isochrones to work.

The extract actually in use is `java-260821.osm.pbf` (whole Java island,
~896MB) rather than a Jakarta-only sub-extract, since Geofabrik didn't
have one available at the time — bigger file, longer one-time build, but
guaranteed coverage.

## Environment variables

See `.env.example` for the full list with inline explanations. Summary:

| Variable | Where it's used | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | already-running Coolify Postgres, not started here |
| `MAPID_API_KEY` | scripts/fetch-mapid-*.js | competition key, never commit |
| `ANTHROPIC_API_KEY` | scripts/classify-categories.js | paid API, only needed to run that one script |
| `JWT_SECRET` | moderator auth (Phase 5) | any long random string |
| `VALHALLA_URL` | scripts/generate-isochrones.js, and the deployed API if isochrones are ever regenerated in production | see "Where Valhalla actually runs" below |
| `PORT` | server.js | local dev only — Coolify sets its own at deploy |
| `ALLOWED_ORIGIN` | server.js CORS | unset = wide open (`*`); set once the frontend has a real URL |

## Reaching the database from your local machine

`DATABASE_URL`'s host is normally Coolify's *internal* Docker network
hostname (e.g. `mk7ayr3frijitxqkgo2a29hm`) — that only resolves from
inside Coolify's network, never from a developer's laptop. That's fine
once the API itself is deployed to Coolify (it'll run inside that same
network and use the internal hostname directly), but it means **you
can't run `prisma migrate dev` from your local machine using that
value**.

To run migrations locally, reach the DB through the server's Tailscale IP
instead (e.g. `100.101.248.124`) with the Coolify Postgres resource's
public port exposed (in this project, `5433`, opened via `ufw allow
5433/tcp` on the server — the Postgres container's `docker-proxy` was
already listening on `0.0.0.0:5433`, not just `127.0.0.1`, so once the
firewall rule was in place it worked). Put that Tailscale-reachable URL
in your local `.env` only — it's never what gets used once the app is
actually deployed and running inside Coolify's network.

**Known gotcha:** `prisma migrate dev` uses a disposable "shadow
database" to replay migration history before applying anything new. That
shadow DB does **not** have the PostGIS extension enabled, so any
migration touching a `geometry(...)` column fails there with
`type "geometry" does not exist` — even though the migration is
completely correct. Workaround used in this project: hand-write the
migration SQL file yourself (or use `--create-only` when the diff
doesn't involve raw SQL), then apply it with `npx prisma migrate deploy`
instead of `migrate dev` — `deploy` applies pending migration files
directly to the target database with no shadow-database step at all.

## Running the API locally

```bash
npm run dev     # node --watch server.js — restarts on file changes
# or
npm start       # plain node server.js
```

## Deploying (Coolify)

This API deploys as a Coolify **Application** resource pointed at this
git repo — Coolify builds and runs it directly, you never manually
`docker build`/`docker run` this in production. (Separate from
`docker-compose.yml`, which is Valhalla-only infrastructure that already
runs persistently on the server — see above. The API and Valhalla are
two independent things Coolify/you manage separately.)

### Build method: Dockerfile, not Nixpacks

This repo includes a `Dockerfile` — in Coolify's Application settings,
set the build pack to **Dockerfile** rather than letting Nixpacks
auto-detect a generic Node project. Nixpacks *would* probably work for a
plain Express app, but this project has two steps a generic Node
auto-detector doesn't know to do: running `prisma generate` before the
app can import a working Prisma Client, and running
`prisma migrate deploy` on every start so schema changes apply
automatically on deploy. The Dockerfile makes both steps explicit and
was built and run locally to confirm it actually works end-to-end
(including a real gotcha it caught: Debian slim images don't ship
OpenSSL, which Prisma's engine needs to detect — without
`apt-get install openssl`, the build succeeds but Prisma silently
guesses the wrong engine binary and can fail at runtime).

If your git repo root is `d:\Hackathon-Mapid\` (with `backend/` as a
subfolder) rather than `backend/` itself, set Coolify's **Base
Directory** to `backend` so it finds the `Dockerfile` and build context
in the right place.

### Environment variables to set in Coolify's dashboard

These are injected by Coolify at deploy time — none of them come from a
committed `.env` file (which stays local-only and gitignored):

| Variable | Value to use in Coolify | Why it differs from local `.env` |
|---|---|---|
| `DATABASE_URL` | The **original internal Coolify hostname** (e.g. `postgres://Casper:...@mk7ayr3frijitxqkgo2a29hm:5432/transitfit`) | The deployed API runs *inside* Coolify's network, alongside Postgres — it should use fast, private internal networking, not the Tailscale IP or public port that local dev needed to reach the DB from outside that network. Grab the current internal connection string fresh from the Postgres resource's page in Coolify rather than reusing the local `.env` value. |
| `VALHALLA_URL` | `http://100.101.248.124:8002` (Tailscale IP) | Same value as local dev — Valhalla runs on the same physical server via Tailscale, and Tailscale routing works independently of whatever Docker network Coolify puts the API container on. Confirm this still resolves once actually deployed rather than assuming. |
| `JWT_SECRET` | A long random string | Can reuse the local dev value or generate a fresh one — either is fine, just keep it secret. |
| `MAPID_API_KEY` | The competition key | Same value as local `.env`. |
| `ANTHROPIC_API_KEY` | Your Anthropic key | Only needed if `classify-categories.js` is ever run against production — the running API itself never calls this. |
| `PORT` | Usually left unset | Coolify typically injects and manages this itself; the app reads `process.env.PORT` either way (`server.js` falls back to `3000` if unset). |
| `ALLOWED_ORIGIN` | Your frontend's real deployed URL | **Leave unset until the frontend has a real URL** (defaults to wide-open `*`, fine for early testing) — once it exists, set this so the API stops accepting requests from arbitrary origins. This is a dashboard change, not a code change. |

### Health check

Set Coolify's health check path to `/api/health` — unlike a generic
"did the process start" check, this route actually confirms the
database connection is alive (`SELECT 1`), not just that Express booted.
A deploy that starts but can't reach `DATABASE_URL` will show as
unhealthy here instead of silently serving 500s.

### After deploying

Hit `https://<your-coolify-app-url>/api/health` and confirm it returns
`{"status":"ok","db":"connected"}`. If it doesn't, check Coolify's
deployment logs first — a wrong `DATABASE_URL` (using the Tailscale IP
instead of the internal hostname, for instance) will show up there as a
Prisma connection error immediately on startup.

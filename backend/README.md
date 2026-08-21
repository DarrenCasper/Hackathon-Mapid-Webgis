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

## Environment variables

See `.env.example` for the full list with inline explanations. Summary:

| Variable | Where it's used | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | already-running Coolify Postgres, not started here |
| `MAPID_API_KEY` | scripts/fetch-mapid-*.js | competition key, never commit |
| `JWT_SECRET` | moderator auth (Phase 5) | any long random string |
| `VALHALLA_URL` | scripts/generate-isochrones.js | local Docker container |
| `PORT` | server.js | local dev only — Coolify sets its own at deploy |

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

Phase 1 currently has no routes mounted yet (routes/ is populated starting
Phase 4) — this just confirms the Express server itself boots and is
reachable.

## Deploying (Coolify)

Covered in Phase 6, once there's actually an app to deploy. Not yet
relevant at this stage.

# TransitFit AI — API Guide (for frontend)

Base URL: `https://mapidapi.darrencasper.com/api`

Every route below is relative to that base — e.g. "`GET /regions`" means
`GET https://mapidapi.darrencasper.com/api/regions`.

No authentication is required for anything except the `/admin/*` routes.
There is no end-user account system in this app at all — commuters use
every public route anonymously.

---

## Conventions used throughout

**Errors** are always `{ "error": "human-readable message" }` with an
appropriate HTTP status — 400 (bad input), 404 (not found), 401
(missing/invalid auth), 409 (conflict), 500 (unexpected server error).
Never a raw database/stack-trace error.

**Geometry** (`location`, `polygon` fields) is always plain GeoJSON —
`{ "type": "Point", "coordinates": [lng, lat] }` or
`{ "type": "Polygon", "coordinates": [...] }`. Coordinates are always
`[longitude, latitude]` (GeoJSON order), not `[lat, lng]`.

**`minutes` query param** (isochrone/pois/context/insights-adjacent
routes) only accepts `10` or `15` — no other value, including `5`.
Defaults to `10` if omitted. A different value returns `400`.

**`category` / `price_tier` on a POI can be `null`.** `null` means "not
yet classified" — it is not the same as a category that's empty or
zero. Handle `null` explicitly in the UI (e.g. an "uncategorized" chip)
rather than assuming every POI has both set.

---

## Public: Regions & Stations

### `GET /health`
Confirms the API and its database connection are both alive.
```json
{ "status": "ok", "db": "connected" }
```

### `GET /regions`
All distinct region values across the network (Jakarta's 5 cities, plus
Tangerang/Bekasi/Bogor/Depok-area subdivisions, plus one grouping for
the far Merak/Rangkasbitung segment).
```json
["bekasi", "bogor", "jakarta_barat", "jakarta_pusat", "..."]
```

### `GET /stations`
**Every station in the network (90 total), all regions.** Use this for
anything that needs the whole map — a single region rarely covers what
you'd expect visually.
```json
[
  {
    "id": "jatinegara",
    "name": "Stasiun Jatinegara",
    "region": "jakarta_timur",
    "prev_station_id": "pondok_jati",
    "next_station_id": "klender",
    "location": { "type": "Point", "coordinates": [106.8703394, -6.2149252] }
  },
  ...
]
```
`prev_station_id`/`next_station_id` are a **rough line-adjacency
reference**, not authoritative KAI schedule data — at junction stations
(Manggarai, Tanah Abang, Duri) they only capture one of several real
directions. Treat as "a" neighbor, not "the" definitive one. Either can
be `null` (line termini have no `next`, etc.).

### `GET /regions/:region/stations`
Same shape as `GET /stations`, filtered to one region. An unknown/empty
region returns `[]` with `200`, not a `404` — `404` is reserved for "a
specific station doesn't exist," not "this filter matched nothing."

### `GET /stations/:id`
One station plus its exits (`exits` is currently always `[]` — no data
source populates individual station exits yet).
```json
{
  "id": "jatinegara", "name": "Stasiun Jatinegara", "region": "jakarta_timur",
  "prev_station_id": "pondok_jati", "next_station_id": "klender",
  "location": { "type": "Point", "coordinates": [106.87, -6.21] },
  "exits": []
}
```
`404` if `id` doesn't match any station.

---

## Public: Isochrones & POIs

### `GET /stations/:id/isochrone?minutes=10`
The walking-distance polygon for that station.
```json
{ "station_id": "jatinegara", "minutes": 10, "polygon": { "type": "Polygon", "coordinates": [...] } }
```
`404` if the station doesn't exist, or if that specific `minutes` value
was never generated for it (shouldn't happen for `10`/`15` on any of the
90 stations, but the check exists).

### `GET /stations/:id/pois?minutes=10`
Every POI whose location falls inside that station's isochrone.
```json
[
  {
    "id": 71, "name": "Roti'O", "category": "bakery", "price_tier": null,
    "source": "mapid_missions", "verified_field": false,
    "menu_utama": "Roti O + Brown Sugar", "harga_rata_rata": 30000,
    "jam_buka": null, "jam_tutup": null, "kondisi_tempat": null,
    "location": { "type": "Point", "coordinates": [106.87, -6.21] }
  },
  ...
]
```
`source` is one of `mapid_missions` (real field survey data),
`openstreetmap` (community-mapped, `verified_field` always `false`),
`jakarta_opendata` (official government data, e.g. Jakarta's public
market registry), `overture_maps` (Overture Maps Foundation open POI
data — the largest source by far, `verified_field` always `false`), or
`mock` (currently unused — no mock data has been seeded).

`category` is one of `kopi_minuman`, `quick_meal`, `warung_makan`,
`bakery`, `casual_dining`, `hiburan`, or `null`.
`price_tier` is one of `ekonomis`, `menengah`, `premium`, or `null` —
in practice this is **always `null` right now**, no data source
populates it yet.

### `GET /stations/:id/context?minutes=10`
Aggregated counts for that station — what a summary card/chart would
bind to, instead of counting the raw POI list client-side.
```json
{
  "station": { "id": "jatinegara", "name": "Stasiun Jatinegara", "region": "jakarta_timur" },
  "minutes": 15,
  "poi_count": 14,
  "poi_count_by_category": {
    "kopi_minuman": 4, "quick_meal": 3, "warung_makan": 2,
    "bakery": 3, "casual_dining": 2, "hiburan": 0, "uncategorized": 0
  },
  "price_distribution": { "ekonomis": 0, "menengah": 0, "premium": 0, "unclassified": 14 }
}
```

### `GET /stations/:id/insights`
The AI-generated "what to expect" recommendation text for that station
— see below for the full picture on this feature.
```json
{
  "station_id": "jatinegara",
  "insight": "Around Jatinegara station you'll find a solid mix of quick bites—traditional warung stalls and a couple of bakeries dominate...",
  "generated_at": "2026-08-23T11:50:46.319Z"
}
```
`insight`/`generated_at` are **both `null`** if this station's insight
hasn't been generated yet — treat that as a normal, expected state (show
a placeholder/skeleton), not an error. **This route never calls the AI
live** — it only ever returns a pre-generated, cached value, so it's
always fast and safe to call on every page load.

---

## Public: Reports

Commuters can report issues near a station or POI — broken sidewalks,
blocked access, flooding, unsafe crossings, closed venues, new informal
vendors, or general notes. Fully anonymous, no login.

### `POST /reports`
```json
// request body
{
  "station_id": "jatinegara",
  "poi_id": null,
  "report_type": "banjir",
  "description": "Genangan air di depan pintu keluar stasiun",
  "photo_url": null
}
```
`poi_id` and `photo_url` are optional (omit or send `null`).
`report_type` must be one of: `trotoar_rusak`, `akses_tertutup`,
`banjir`, `penyeberangan_tidak_aman`, `tempat_tutup`, `umkm_baru`,
`info_lainnya`.

Returns `201` with the created report (status starts as `"pending"`) on
success. `400` if `station_id`/`poi_id` don't reference real records, or
if required fields are missing/invalid.

---

## Admin (moderator-only — requires login)

Everything under `/admin/*` except `/admin/login` itself requires a
valid JWT. There is no public sign-up — moderator accounts are created
manually by the project owner.

### `POST /admin/login`
```json
// request
{ "email": "mod@example.com", "password": "..." }
// response
{ "token": "eyJhbGc..." }
```
Send this token as `Authorization: Bearer <token>` on every other
`/admin/*` request. Tokens expire after 7 days. `401` on wrong
email/password (deliberately the same error for both — don't rely on
the message to distinguish which was wrong).

### `GET /admin/reports?status=pending`
List reports, optionally filtered by `status` (`pending`, `verified`,
`rejected`, or `applied`). Includes the related `station`, `poi`, and
`moderator` objects inline. Requires auth.

### `POST /admin/reports/:id/verify`
```json
{ "status": "verified", "moderator_note": "Confirmed via CCTV footage" }
```
`status` must be `"verified"` or `"rejected"` (not `"applied"` — that's
presumably set by a separate, not-yet-built workflow). Sets
`moderator_id` from the authenticated token, sets `resolved_at`.
Requires auth. `404` if the report doesn't exist.

### `POST /admin/stations/:id/regenerate-insight`
Forces a live regeneration of one station's AI insight right now,
bypassing the daily automatic refresh. Requires auth — **this is the
only route in the whole API where a request triggers a paid AI API
call**, which is exactly why it's admin-only rather than public.
```json
{
  "station_id": "jatinegara",
  "insight": "...",
  "generated_at": "2026-08-23T12:03:11.000Z"
}
```
`404` if the station doesn't exist, `409` if it has no 15-minute
isochrone (shouldn't happen for any of the 90 real stations).

---

## About the AI insight feature

A few things worth understanding if you're building UI around
`insight`/`generated_at`:

- **It's cached, not live.** The public `GET /stations/:id/insights`
  route only ever reads a pre-generated value from the database — it
  never calls Claude. This is deliberate: a public route that generated
  text on every page view would have no natural cost limit.
- **It refreshes automatically, but only when data actually changes.**
  A daily background job checks each station's real POI data against
  when its insight was last generated, and only regenerates the ones
  that are genuinely stale — not all 90 every day. If you're testing and
  a station's insight isn't updating after a data change, it may take up
  to 24 hours for the daily job to catch it, or ask the backend to run
  `POST /admin/stations/:id/regenerate-insight` for an immediate refresh.
- **Some stations may not have an insight yet** if they were added after
  the last generation run — `insight: null` is a real, expected state
  your UI needs to handle gracefully (not an error).
- **The text is grounded in real data** — the AI is instructed not to
  invent specific business names, prices, or hours beyond what's
  actually in the database, and to be honest when a station's coverage
  is genuinely thin rather than inventing options to fill space.

---

## CORS note

The API currently allows requests from any origin. Once this frontend
has a real deployed URL, the backend will restrict `Access-Control-Allow-Origin`
to that specific domain — tell the backend team your deployed URL when
you have one, since after that change requests from `localhost` during
your own local dev may need to be separately allowed too.

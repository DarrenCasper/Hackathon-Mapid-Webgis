// Entertainment/hiburan data source ("Community Maps" in the proposal
// doc, "Activities" in the API docs — same dataset). For each station's
// 15-minute isochrone, fetches every activity in that polygon and stores
// it verbatim in MapidActivity. No hashtag filter — fetch everything;
// keyword-based hiburan filtering is a separate, later script once real
// description text is in the database to inspect.
//
// PAGINATION FINDING (see build.md Phase 3 for the full investigation):
// this endpoint's response has no limit/offset/hasMore fields, unlike
// Missions. Testing the same broad, unfiltered query against a box around
// our 7 stations, all of Jakarta, and all of Java ALL returned exactly
// 60 activities with meta.total also reporting 60 — strong evidence
// meta.total is just activities.length computed AFTER a silent 60-item
// cap, not an independent database count. A tiny ~200m test polygon
// correctly returned 0, so the endpoint does filter spatially — it's not
// ignoring the polygon entirely.
//
// Decision (confirmed with project owner): query per-station (a single
// station's 15-min isochrone is far smaller than "all of Java", so far
// less likely to ever contain 60 real activities) rather than one big
// query, AND loudly warn if any station's result lands on exactly 60 —
// that's the signal a station may be silently truncated and would need
// a narrower query (e.g. split by date range) to retrieve the rest.
//
// Run standalone: node scripts/fetch-mapid-activities.js
require("dotenv").config();
const prisma = require("../lib/db");

const MAPID_API_KEY = process.env.MAPID_API_KEY;
const ISOCHRONE_MINUTES = 15;
const SUSPECTED_CAP = 60;

async function getStationIsochrones() {
  return prisma.$queryRaw`
    SELECT s.id AS station_id, s.name AS station_name, ST_AsGeoJSON(i.polygon) AS polygon_geojson
    FROM "Station" s
    JOIN "Isochrone" i ON i.station_id = s.id
    WHERE i.minutes = ${ISOCHRONE_MINUTES}
    ORDER BY s.id
  `;
}

async function fetchActivitiesForPolygon(polygon) {
  const res = await fetch("https://server.mapid.io/web/competition/activities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAPID_API_KEY,
    },
    // Deliberately omitting hashtag/start_date/end_date/author — fetch
    // everything in the polygon, per brief.
    body: JSON.stringify({ feature: polygon }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MAPID activities returned ${res.status}:\n${text}`);
  }
  const body = JSON.parse(text);
  return { activities: body.data.activities, total: body.meta?.total };
}

async function saveActivity(activity) {
  const [lng, lat] = activity.geometry.coordinates;
  await prisma.$executeRaw`
    INSERT INTO "MapidActivity" (
      id, title, description, location, media_urls,
      user_name, user_full_name, community_name,
      total_comment, likes_count, source_created_at, raw_properties
    )
    VALUES (
      ${activity._id},
      ${activity.title ?? null},
      ${activity.description ?? null},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${activity.medias ?? []}::text[],
      ${activity.user_name ?? null},
      ${activity.user_full_name ?? null},
      ${activity.community_name ?? null},
      ${activity.total_comment ?? null},
      ${activity.likes?.length ?? null},
      ${activity.created_at ? new Date(activity.created_at) : null},
      ${JSON.stringify(activity)}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      location = EXCLUDED.location,
      media_urls = EXCLUDED.media_urls,
      user_name = EXCLUDED.user_name,
      user_full_name = EXCLUDED.user_full_name,
      community_name = EXCLUDED.community_name,
      total_comment = EXCLUDED.total_comment,
      likes_count = EXCLUDED.likes_count,
      source_created_at = EXCLUDED.source_created_at,
      raw_properties = EXCLUDED.raw_properties
  `;
}

async function main() {
  if (!MAPID_API_KEY) {
    console.error("MAPID_API_KEY is not set in .env");
    process.exitCode = 1;
    return;
  }

  const stationIsochrones = await getStationIsochrones();
  if (stationIsochrones.length === 0) {
    console.error(
      `No ${ISOCHRONE_MINUTES}-minute isochrones found — run generate-isochrones.js first.`
    );
    process.exitCode = 1;
    return;
  }

  let totalSaved = 0;

  for (const row of stationIsochrones) {
    const polygon = JSON.parse(row.polygon_geojson);
    try {
      const { activities, total } = await fetchActivitiesForPolygon(polygon);

      if (activities.length === SUSPECTED_CAP) {
        console.warn(
          `  ⚠ ${row.station_id}: got exactly ${SUSPECTED_CAP} activities (meta.total=${total}). ` +
            `This matches the suspected undocumented cap — this station's data may be ` +
            `incomplete. Consider re-running with a date-range split for this station.`
        );
      }

      for (const activity of activities) {
        await saveActivity(activity);
      }
      totalSaved += activities.length;
      console.log(`  ✓ ${row.station_id} — ${row.station_name}: ${activities.length} activities`);
    } catch (err) {
      console.error(`  ✗ ${row.station_id}:`, err.message);
    }
  }

  console.log(`Done. ${totalSaved} activity rows saved/updated.`);
}

main()
  .catch((err) => {
    console.error("Fatal error fetching MAPID activities:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

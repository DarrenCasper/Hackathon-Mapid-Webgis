// One-time data construction script — NOT part of the standing scripts/
// pipeline (underscore prefix marks it as such). Builds data/stations.geojson
// for the full Jabodetabek expansion from the OSM-verified coordinates
// gathered this session, plus region + prev/next assigned from the KAI
// Commuter route map the project owner provided.
//
// Judgment calls made here, flagged rather than silently decided:
// - Excluded 8 OSM-tagged KAI Commuter stations that are on a DIFFERENT
//   line not shown on the "Jabodetabek & Merak" map: Bandara Soekarno-Hatta,
//   BNI City (airport rail link), Jakarta Gudang, Batutulis, Bogor Paledang,
//   Ciomas, Cigombong, Maseng (Bogor-Sukabumi extension, south of Bogor,
//   not part of Jabodetabek or the Merak line).
// - Included Kemayoran, Rajawali, Jakarta International Stadium even
//   though they weren't clearly legible in the map transcription — all
//   three are genuinely tagged KAI Commuter and geographically fit the
//   loop-line corridor described elsewhere on the map, likely just missed
//   in a dense image region rather than genuinely absent.
// - region uses coarse, well-known administrative groupings
//   (jakarta_pusat/utara/barat/timur/selatan, tangerang, tangerang_selatan,
//   kabupaten_tangerang, depok, bogor, kabupaten_bogor, bekasi,
//   kabupaten_bekasi, banten_barat for the Merak/Cilegon/Serang/Lebak
//   cluster) — not authoritative kelurahan-level lookup, reasonable
//   general geography.
// - prev/next is a SIMPLIFIED single-neighbor-per-direction model. The
//   real network has genuine loops and junctions (Manggarai, Tanah Abang,
//   Duri, Jakarta Kota) that a simple prev/next can't fully represent —
//   picked one reasonable through-direction per segment. This matches
//   the "just a data reference" framing already agreed, not meant to be
//   perfect schedule-grade topology.

const fs = require("fs");
const path = require("path");

const coords = require("../data/jabodetabek-coords.json");

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// [name, region] in line order. `null` region entries inherit from the
// nearest prior real assignment in the same line (keeps this table
// shorter to read/verify) — resolved below.
const LINES = {
  tangerang: [
    ["Tangerang", "tangerang"],
    ["Tanah Tinggi", "tangerang"],
    ["Batu Ceper", "tangerang"],
    ["Poris", "tangerang"],
    ["Kalideres", "jakarta_barat"],
    ["Rawa Buaya", "jakarta_barat"],
    ["Bojong Indah", "jakarta_barat"],
    ["Taman Kota", "jakarta_barat"],
    ["Pesing", "jakarta_barat"],
    ["Grogol", "jakarta_barat"],
    ["Duri", "jakarta_barat"],
    ["Tanah Abang", "jakarta_pusat"],
  ],
  loop_north: [
    ["Angke", "jakarta_barat"],
    ["Jakarta Kota", "jakarta_barat"],
    ["Jayakarta", "jakarta_pusat"],
    ["Mangga Besar", "jakarta_pusat"],
    ["Sawah Besar", "jakarta_pusat"],
    ["Juanda", "jakarta_pusat"],
    ["Gambir", "jakarta_pusat"],
    ["Gondangdia", "jakarta_pusat"],
    ["Cikini", "jakarta_pusat"],
    ["Manggarai", "jakarta_selatan"],
  ],
  sudirman_corridor: [
    ["Tanah Abang", "jakarta_pusat"], // shared with tangerang line — connects both, not duplicated below
    ["Karet", "jakarta_pusat"],
    ["Sudirman", "jakarta_pusat"],
    ["Manggarai", "jakarta_selatan"], // shared terminus
  ],
  priok_branch: [
    ["Kampung Bandan", "jakarta_utara"],
    ["Rajawali", "jakarta_utara"],
    ["Kemayoran", "jakarta_pusat"],
    ["Pasar Senen", "jakarta_pusat"],
    ["Kramat", "jakarta_pusat"],
    ["Gang Sentiong", "jakarta_pusat"],
    ["Ancol", "jakarta_utara"],
    ["Tanjung Priuk", "jakarta_utara"],
    ["Jakarta International Stadium", "jakarta_utara"],
  ],
  merak: [
    ["Tanah Abang", "jakarta_pusat"], // shared
    ["Palmerah", "jakarta_pusat"],
    ["Kebayoran", "jakarta_selatan"],
    ["Pondok Ranji", "tangerang_selatan"],
    ["Jurangmangu", "tangerang_selatan"],
    ["Sudimara", "tangerang_selatan"],
    ["Rawa Buntu", "tangerang_selatan"],
    ["Serpong", "tangerang_selatan"],
    ["Cisauk", "kabupaten_tangerang"],
    ["Cicayur", "kabupaten_tangerang"],
    ["Parungpanjang", "kabupaten_tangerang"],
    ["Cilejit", "kabupaten_tangerang"],
    ["Daru", "kabupaten_tangerang"],
    ["Tenjo", "kabupaten_tangerang"],
    ["Tigaraksa", "kabupaten_tangerang"],
    ["Jatake", "kabupaten_tangerang"],
    ["Cikoya", "kabupaten_tangerang"],
    ["Maja", "kabupaten_tangerang"],
    ["Citeras", "kabupaten_tangerang"],
    ["Rangkasbitung", "banten_barat"],
    ["Catang", "banten_barat"],
    ["Walantaka", "banten_barat"],
    ["Karangantu", "banten_barat"],
    ["Cilegon", "banten_barat"],
    ["Krenceng", "banten_barat"],
    // Merak itself excluded — not found in OSM, no coordinate available
  ],
  bogor: [
    ["Manggarai", "jakarta_selatan"], // shared
    ["Tebet", "jakarta_selatan"],
    ["Cawang", "jakarta_timur"],
    ["Duren Kalibata", "jakarta_selatan"],
    ["Pasar Minggu Baru", "jakarta_selatan"],
    ["Pasar Minggu", "jakarta_selatan"],
    ["Tanjung Barat", "jakarta_selatan"],
    ["Lenteng Agung", "jakarta_selatan"],
    ["Universitas Pancasila", "depok"],
    ["Universitas Indonesia", "depok"],
    ["Pondok Cina", "depok"],
    ["Depok Baru", "depok"],
    ["Depok", "depok"],
    ["Citayam", "depok"],
    ["Bojonggede", "kabupaten_bogor"],
    ["Cilebut", "kabupaten_bogor"],
    ["Bogor", "bogor"],
  ],
  nambo_branch: [
    ["Citayam", "depok"], // shared
    ["Pondok Rajeg", "kabupaten_bogor"],
    ["Cibinong", "kabupaten_bogor"],
    // Gunung Putri excluded — not found in OSM, no coordinate available
    ["Nambo", "kabupaten_bogor"],
  ],
  bekasi: [
    ["Manggarai", "jakarta_selatan"], // shared
    ["Matraman", "jakarta_timur"],
    ["Jatinegara", "jakarta_timur"],
    ["Klender", "jakarta_timur"],
    ["Buaran", "jakarta_timur"],
    ["Klender Baru", "jakarta_timur"],
    ["Cakung", "jakarta_timur"],
    ["Kranji", "bekasi"],
    ["Bekasi", "bekasi"],
    ["Bekasi Timur", "bekasi"],
    ["Tambun", "kabupaten_bekasi"],
    ["Cibitung", "kabupaten_bekasi"],
    ["Metland Telagamurni", "kabupaten_bekasi"],
    ["Cikarang", "kabupaten_bekasi"],
  ],
  jatinegara_link: [
    ["Pondok Jati", "jakarta_timur"],
    ["Jatinegara", "jakarta_timur"], // shared — Pondok Jati sits between Manggarai and Jatinegara
  ],
};

// Build station registry: name -> { region } (first assignment wins if
// a name recurs across lines with the same region, which they all do).
const stations = new Map();
for (const line of Object.values(LINES)) {
  for (const [name, region] of line) {
    if (!stations.has(name)) stations.set(name, { region });
  }
}

// prev/next: walk each line in order, recording forward links. A name
// that already has a next_station_id from an earlier line keeps it
// (first line to mention a station "wins" the link) — avoids overwriting
// a real sequence with a shared-terminus line's different direction.
for (const line of Object.values(LINES)) {
  for (let i = 0; i < line.length - 1; i++) {
    const [curName] = line[i];
    const [nextName] = line[i + 1];
    const cur = stations.get(curName);
    if (!cur.next) cur.next = nextName;
    const next = stations.get(nextName);
    if (!next.prev) next.prev = curName;
  }
}

// Pondok Jati's real position (between Manggarai and Jatinegara,
// confirmed via its OSM coordinate sitting geographically between them)
// isn't well captured by the simple per-line walk above since it's a
// single-station "line" — wire it in manually.
stations.get("Jatinegara").prev = "Pondok Jati";

const features = [];
const missing = [];
for (const [name, { region, prev, next }] of stations) {
  const coord = coords[name];
  if (!coord) {
    missing.push(name);
    continue;
  }
  features.push({
    type: "Feature",
    properties: {
      station_id: slug(name),
      name: `Stasiun ${name}`,
      region,
      prev_station_id: prev ? slug(prev) : null,
      next_station_id: next ? slug(next) : null,
    },
    geometry: { type: "Point", coordinates: coord },
  });
}

console.log(`Built ${features.length} station features.`);
if (missing.length) console.log("No coordinate found for:", missing.join(", "));

const geojson = { type: "FeatureCollection", features };
fs.writeFileSync(
  path.join(__dirname, "..", "data", "jabodetabek-stations.geojson"),
  JSON.stringify(geojson, null, 2)
);
console.log("Wrote data/jabodetabek-stations.geojson");

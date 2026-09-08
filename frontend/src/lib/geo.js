// Haversine distance dalam meter antara dua titik [lng, lat] (urutan GeoJSON,
// sama seperti yang dipakai backend — lihat guide.md "Conventions").
export function distanceMeters([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Estimasi waktu jalan kaki dari jarak garis lurus, memakai kecepatan 4,5
// km/jam yang sama dengan asumsi backend di §3.3 proposal. Ini SELALU
// estimasi garis lurus, bukan waktu tempuh riil — lihat frontend.md §8,
// jangan label ini sebagai "waktu tempuh aktual" di UI manapun.
const WALK_SPEED_KMH = 4.5;
export function estimateWalkMinutes(meters) {
  const hours = meters / 1000 / WALK_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}

export function formatMeters(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Bounding box [[minLng,minLat],[maxLng,maxLat]] dari GeoJSON Polygon —
// dipakai IsochroneLayer untuk map.fitBounds tanpa perlu tambah dependency
// turf hanya demi satu fungsi ini.
export function polygonBounds(polygon) {
  const ring = polygon.coordinates[0];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function formatRupiah(amount) {
  if (amount == null) return "Data harga belum tersedia";
  return `≈ Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

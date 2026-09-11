// Garis rute jalan kaki untuk WalkingRouteLine — lihat frontend.md §10.
// Backend TransitFit AI TIDAK expose endpoint routing (Valhalla-nya cuma
// reachable dari server backend sendiri via Tailscale privat), jadi rute
// dihitung di sini, di frontend, lewat OpenRouteService (ORS) — gratis,
// profile foot-walking, CORS diizinkan dipanggil langsung dari browser.
//
// Trade-off yang disadari: ORS pakai mesin/data jalan sendiri (OSM, tapi
// beda engine dari Valhalla yang dipakai backend untuk isochrone), jadi
// garis rute bisa sedikit tidak konsisten dengan tepi polygon isochrone
// di boundary-nya. Untuk demo ini tetap jauh lebih baik daripada garis
// lurus — fallback ke garis lurus hanya terjadi kalau ORS gagal/limit habis.

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
const ORS_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

// @param from,to — [lng, lat], urutan GeoJSON sama seperti field `location` dari backend
// @returns { coordinates: [lng,lat][], isFallback: boolean }
export async function fetchWalkingRoute(from, to) {
  if (!ORS_API_KEY) {
    return { coordinates: [from, to], isFallback: true };
  }

  try {
    const res = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: [from, to] }),
    });

    if (!res.ok) throw new Error(`ORS returned ${res.status}`);

    const data = await res.json();
    const coordinates = data?.features?.[0]?.geometry?.coordinates;
    if (!coordinates || coordinates.length === 0) {
      throw new Error("ORS response had no route geometry");
    }

    return { coordinates, isFallback: false };
  } catch (err) {
    console.warn("[routing] ORS gagal, jatuh ke garis lurus:", err.message);
    return { coordinates: [from, to], isFallback: true };
  }
}

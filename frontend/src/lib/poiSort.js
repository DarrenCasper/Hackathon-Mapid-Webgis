import { distanceMeters } from "./geo.js";

/** @typedef {'recommended' | 'distance' | 'price-asc' | 'price-desc'} SortOrder */
/** @typedef {{id: string, name: string, harga_rata_rata: number | null, verified_field: boolean, location: {coordinates: [number, number]}}} SortablePoi */

/**
 * Unknown prices follow known prices in either direction; never treat them as zero.
 * Price is the primary key, followed by distance, name, and ID for stable ties.
 * @param {readonly SortablePoi[]} pois
 * @param {SortOrder} order
 * @param {[number, number] | undefined} coordinates
 * @returns {SortablePoi[]}
 */
export function sortPois(pois, order, coordinates) {
  return [...pois].sort((a, b) => {
    if (order === "price-asc" || order === "price-desc") {
      const priceA = Number.isFinite(a.harga_rata_rata) && a.harga_rata_rata >= 0 ? a.harga_rata_rata : null;
      const priceB = Number.isFinite(b.harga_rata_rata) && b.harga_rata_rata >= 0 ? b.harga_rata_rata : null;
      if (priceA === null && priceB !== null) return 1;
      if (priceB === null && priceA !== null) return -1;
      if (priceA !== null && priceB !== null && priceA !== priceB) {
        return order === "price-asc" ? priceA - priceB : priceB - priceA;
      }
    }
    if (order === "recommended" && a.verified_field !== b.verified_field) return a.verified_field ? -1 : 1;
    if (coordinates) {
      const difference = distanceMeters(coordinates, a.location.coordinates) - distanceMeters(coordinates, b.location.coordinates);
      if (difference !== 0) return difference;
    }
    return a.name.localeCompare(b.name, "id") || String(a.id).localeCompare(String(b.id));
  });
}

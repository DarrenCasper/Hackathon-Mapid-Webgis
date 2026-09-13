import assert from "node:assert/strict";
import { sortPois } from "../src/lib/poiSort.js";
import { applyFilters } from "../src/lib/poiFilters.js";

// A fixed dataset is necessary: the live Cikini response has no known prices.
const coordinates = [106.84, -6.2];
const places = Object.freeze([
  Object.freeze({ id: "unknown", name: "Tanpa harga", harga_rata_rata: null, verified_field: true, category: "kopi_minuman", location: { coordinates } }),
  Object.freeze({ id: "premium", name: "Kopi Premium", harga_rata_rata: 50000, verified_field: true, category: "kopi_minuman", location: { coordinates } }),
  Object.freeze({ id: "budget", name: "Kopi Hemat", harga_rata_rata: 9000, verified_field: false, category: "kopi_minuman", location: { coordinates: [106.85, -6.2] } }),
  Object.freeze({ id: "mid", name: "Roti", harga_rata_rata: 25000, verified_field: false, category: "bakery", location: { coordinates } }),
]);
const ids = (items) => items.map((item) => item.id);
assert.deepEqual(ids(sortPois(places, "price-asc", coordinates)), ["budget", "mid", "premium", "unknown"]);
assert.deepEqual(ids(sortPois(places, "price-desc", coordinates)), ["premium", "mid", "budget", "unknown"]);
assert.deepEqual(ids(places), ["unknown", "premium", "budget", "mid"]);
const filtered = applyFilters(places, { categories: [], maxPrice: 25000, onlyValidated: false }, "");
assert.deepEqual(ids(sortPois(filtered, "price-asc", coordinates)), ["budget", "mid"]);
assert.deepEqual(ids(applyFilters(places, { categories: ["kopi_minuman"], maxPrice: null, onlyValidated: false }, "Premium")), ["premium"]);
assert.equal(sortPois([], "price-asc", undefined).length, 0);
const zeroAndMissing = [places[0], { ...places[1], id: "zero", harga_rata_rata: 0 }];
assert.deepEqual(ids(sortPois(zeroAndMissing, "price-asc", undefined)), ["zero", "unknown"]);
assert.deepEqual(ids(sortPois(zeroAndMissing, "price-desc", undefined)), ["zero", "unknown"]);
console.log("PASS: numeric price ordering, null-last both ways, zero price, immutable input, inclusive budget, category/name search, empty list.");

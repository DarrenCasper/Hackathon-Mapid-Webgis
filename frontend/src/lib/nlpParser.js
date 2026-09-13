// Parser keyword sederhana untuk NLP search bar — BUKAN panggilan ke LLM.
// Lihat frontend.md §11: ini keputusan sadar untuk MVP supaya search bar
// terasa "pintar" tanpa butuh endpoint AI baru yang belum ada di backend.
// Kalau nanti backend punya endpoint proxy AI (mis. POST /api/nlp/parse),
// ganti isi fungsi ini saja — pemanggilnya (NlpSearchBar.jsx) tidak perlu
// berubah, cukup terima object filter yang sama bentuknya.

const CATEGORY_SYNONYMS = {
  kopi_minuman: ["kopi", "coffee", "ngopi", "kedai kopi", "es teh", "minuman"],
  quick_meal: ["cepat saji", "fast food", "ayam goreng", "burger", "siap saji"],
  warung_makan: ["warung", "warteg", "nasi", "makan siang", "rumah makan"],
  bakery: ["roti", "bakery", "kue", "pastry", "donat"],
  casual_dining: ["restoran", "resto", "cafe", "kafe", "dining"],
  hiburan: ["hiburan", "nongkrong", "bioskop", "karaoke", "billiard"],
};

const CHEAP_KEYWORDS = ["murah", "hemat", "ekonomis", "budget"];
const MINUTES_REGEX = /(\d+)\s*(menit|min)/i;

// Bulatkan ke opsi yang benar-benar didukung backend: hanya 10 atau 15
// (lihat frontend.md §1 — proposal janji 5/10/15, backend cuma generate
// 10/15).
function roundToSupportedMinutes(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n - 10) <= Math.abs(n - 15) ? 10 : 15;
}

/**
 * @param {string} input teks bebas dari search bar
 * @returns {{ minutes: number|null, maxPrice: number|null, categories: string[], query: string }}
 */
export function parseSearchQuery(input) {
  const text = input.toLowerCase().trim();
  const result = { minutes: null, maxPrice: null, categories: [], query: input.trim() };

  if (!text) return result;

  const minutesMatch = text.match(MINUTES_REGEX);
  if (minutesMatch) {
    result.minutes = roundToSupportedMinutes(minutesMatch[1]);
  }

  if (CHEAP_KEYWORDS.some((kw) => text.includes(kw))) {
    result.maxPrice = 20000; // ambang "murah" — angka kasar, bisa disetel ulang
  }

  for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some((kw) => text.includes(kw))) {
      result.categories.push(category);
    }
  }

  return result;
}

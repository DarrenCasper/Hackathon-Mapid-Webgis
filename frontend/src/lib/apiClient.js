// Satu titik masuk untuk semua panggilan ke backend TransitFit AI.
// Kontrak endpoint & error shape ada di guide.md (repo root).
const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

// ApiError membedakan 404 (resource tidak ada — layak ditampilkan sebagai
// EmptyState) dari error lain (400/500 — layak ditampilkan sebagai
// ErrorState dengan tombol retry). Lihat frontend.md §5.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL belum diisi di frontend/.env.local. Isi URL backend beserta /api, lalu restart frontend.", 0);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // respons bukan JSON (jarang terjadi, backend selalu balas JSON per guide.md)
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
};

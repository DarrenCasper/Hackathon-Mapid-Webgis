const REPORT_TYPES = ["trotoar_rusak","akses_tertutup","banjir","penyeberangan_tidak_aman","tempat_tutup","umkm_baru","info_lainnya"];
function validateReport(body) {
  if (typeof body.station_id !== "string" || !body.station_id.trim()) return "Pilih stasiun laporan.";
  if (!REPORT_TYPES.includes(body.report_type)) return "Jenis laporan tidak valid.";
  if (typeof body.description !== "string" || body.description.trim().length < 5 || body.description.trim().length > 2000) return "Deskripsi harus 5–2000 karakter.";
  if (!Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180 || !Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90) return "Koordinat longitude/latitude wajib dan harus valid.";
  if (typeof body.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) return "request_id harus UUID v4.";
  if (body.poi_id != null && (!Number.isSafeInteger(body.poi_id) || body.poi_id <= 0)) return "poi_id tidak valid.";
  if (body.photo_url != null) {
    if (typeof body.photo_url !== "string" || body.photo_url.length > 2800000) return "Foto maksimal 2 MB.";
    const match = body.photo_url.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return "Foto harus JPG, PNG, atau WebP dalam format data URL.";
    const bytes = Buffer.from(match[2],"base64");
    if (bytes.length > 2*1024*1024 || bytes.length < 12) return "Ukuran foto tidak valid.";
    const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === "png" ? bytes.subarray(0,8).toString("hex") === "89504e470d0a1a0a" : bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
    if (!valid) return "Isi foto tidak sesuai tipe file.";
  }
  return null;
}
module.exports = {validateReport};


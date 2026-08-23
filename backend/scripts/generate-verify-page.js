// Substitutes the real MAPID_API_KEY (and the local API base URL) into
// verify/map-check.template.html, writing verify/map-check.local.html.
// The .local.html file is gitignored — it has the real key inline in a
// URL (same pattern MAPID's own usage docs use), so it must never be
// committed, unlike the key-free template.
//
// Run standalone: node scripts/generate-verify-page.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const TEMPLATE_PATH = path.join(__dirname, "..", "verify", "map-check.template.html");
const OUTPUT_PATH = path.join(__dirname, "..", "verify", "map-check.local.html");

function main() {
  if (!process.env.MAPID_API_KEY) {
    console.error("MAPID_API_KEY is not set in .env");
    process.exitCode = 1;
    return;
  }

  const apiBase = `http://localhost:${process.env.PORT || 3000}/api`;

  let html = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  html = html.replaceAll("__MAPID_API_KEY__", process.env.MAPID_API_KEY);
  html = html.replaceAll("__API_BASE__", apiBase);

  fs.writeFileSync(OUTPUT_PATH, html);
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`(points at ${apiBase} — make sure the server is running there before opening this file)`);
}

main();

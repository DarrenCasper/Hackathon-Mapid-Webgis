import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [playwrightPath, outputPath] = process.argv.slice(2);
if (!playwrightPath || !outputPath) throw new Error("Pass the Playwright module path and screenshot output directory.");
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
await mkdir(outputPath, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const desktop = await browser.newContext({ viewport: { width: 1512, height: 982 } });
const page = await desktop.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByLabel("Stasiun awal").selectOption("cikini");
await page.getByLabel("Urutkan tempat").waitFor({ timeout: 30000 });
await page.getByLabel("Urutkan tempat").selectOption("price-asc");
await page.getByRole("status").filter({ hasText: "Harga tempat" }).waitFor();
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
await page.screenshot({ path: outputPath + "/desktop.png", fullPage: true });

// Isolated browser response fixture exercises prices absent from the live API.
const fixture = [
  { id: "unknown", name: "Harga belum diketahui", category: "kopi_minuman", harga_rata_rata: null, verified_field: true },
  { id: "premium", name: "Kopi Premium", category: "kopi_minuman", harga_rata_rata: 50000, verified_field: true },
  { id: "budget", name: "Kopi Hemat", category: "kopi_minuman", harga_rata_rata: 9000, verified_field: false },
  { id: "mid", name: "Roti Sore", category: "bakery", harga_rata_rata: 25000, verified_field: false },
].map((poi) => ({ ...poi, source: "osm", location: { type: "Point", coordinates: [106.839, -6.198] } }));
const android = await browser.newContext({ ...devices["Pixel 7"] });
await android.route("**/api/stations/cikini/pois?*", (route) => route.fulfill({ json: fixture }));
const mobile = await android.newPage();
mobile.on("pageerror", (error) => errors.push(error.message));
await mobile.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await mobile.getByLabel("Stasiun awal").selectOption("cikini");
await mobile.getByRole("button", { name: "Daftar tempat", exact: true }).click();
const sort = mobile.getByLabel("Urutkan tempat");
await sort.waitFor({ timeout: 30000 });
await sort.selectOption("price-asc");
await mobile.waitForFunction(() => document.querySelector(".place-card")?.textContent.includes("Kopi Hemat"));
assert.match(await mobile.locator(".place-card").last().innerText(), /Harga belum diketahui/);
await sort.selectOption("price-desc");
await mobile.waitForFunction(() => document.querySelector(".place-card")?.textContent.includes("Kopi Premium"));
assert.match(await mobile.locator(".place-card").last().innerText(), /Harga belum diketahui/);
await mobile.getByRole("button", { name: /Sesuaikan pencarian/ }).click();
await mobile.getByLabel("Anggaran maksimal").selectOption("25000");
await mobile.waitForFunction(() => document.querySelectorAll(".place-card").length === 2);
await mobile.getByRole("button", { name: /Reset pencarian/ }).click();
await mobile.waitForFunction(() => document.querySelectorAll(".place-card").length === 4);
await mobile.locator(".place-card").first().click();
assert.equal(await mobile.locator(".place-card").first().getAttribute("aria-pressed"), "true");
await mobile.getByRole("button", { name: /Sesuaikan pencarian/ }).click();
await mobile.screenshot({ path: outputPath + "/android-price-fixture.png", fullPage: true });
for (const width of [360, 393, 412, 768, 1024]) {
  await mobile.setViewportSize({ width, height: 851 });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Horizontal overflow at " + width);
}
assert.deepEqual(errors, []);
console.log("PASS: live API, unknown-price message, price sorting in both directions, budget, reset, card selection, Android touch viewport, widths 360/393/412/768/1024, no page errors.");
await browser.close();

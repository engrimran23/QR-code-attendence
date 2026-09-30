import { createRequire } from "module";
const require = createRequire(import.meta.url);
const puppeteer = require("D:/Employee force/My AI employee Force/QR Code attendence/frontend/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js");
import { writeFileSync } from "fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL    = "http://localhost:3000";
const EMAIL  = "branch@school.com";
const PASS   = "Branch@123";
const SHOT   = "C:\\Users\\lenovo\\AppData\\Local\\Temp\\dashboard.png";

(async () => {
  console.log("Launching Chrome…");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,          // open visible window
    defaultViewport: { width: 1400, height: 860 },
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 860 });

  // ── 1. Open login page ──────────────────────────────────────────────────
  console.log("Opening login page…");
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 15000 });
  await page.screenshot({ path: SHOT.replace(".png", "_login.png") });

  // ── 2. Fill credentials ─────────────────────────────────────────────────
  console.log("Filling credentials…");
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i], input[name="email"]', { timeout: 8000 });
  await page.click('input[type="email"], input[placeholder*="email" i], input[name="email"]');
  await page.type('input[type="email"], input[placeholder*="email" i], input[name="email"]', EMAIL, { delay: 40 });

  await page.click('input[type="password"]');
  await page.type('input[type="password"]', PASS, { delay: 40 });

  // ── 3. Submit ────────────────────────────────────────────────────────────
  console.log("Submitting login…");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  // ── 4. Navigate to Students & QR ────────────────────────────────────────
  console.log("Navigating to Students & QR page…");
  await page.goto(`${URL}/students`, { waitUntil: "networkidle2", timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: SHOT });

  console.log(`Screenshot saved: ${SHOT}`);
  console.log("Dashboard is open. Browser staying visible.");
  // keep browser open — don't call browser.close()
})().catch(e => { console.error("Error:", e.message); process.exit(1); });

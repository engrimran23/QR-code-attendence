const puppeteer = require("./frontend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL    = "http://localhost:3001";
const EMAIL  = "branch@school.com";
const PASS   = "Branch@123";

(async () => {
  console.log("Launching Chrome…");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--disable-infobars"],
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  console.log("Opening login page…");
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 20000 });

  await page.waitForSelector('input', { timeout: 8000 });
  const inputs = await page.$$('input');

  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type(EMAIL, { delay: 60 });

  await inputs[1].click({ clickCount: 3 });
  await inputs[1].type(PASS, { delay: 60 });

  console.log("Logging in…");
  const btn = await page.$('button[type="submit"]') || await page.$('button');
  if (btn) await btn.click();

  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 12000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  const currentUrl = page.url();
  console.log("Landed on:", currentUrl);
  console.log("Dashboard is open!");
})().catch(e => { console.error("Error:", e.message); process.exit(1); });

// Screenshots of the LeoToby homepage with Bank It in the lineup (serve the built site, e.g. `npx serve out -l 4312`).
import { launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const browser = await launch();
for (const [w, h] of [[1280, 900], [1536, 900], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(process.env.LEOTOBY_URL ?? "http://localhost:4312/");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/home-top-${w}.png` });
  const card = page.locator("article", { hasText: "Bank It" });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/home-card-${w}.png` });
  const nav = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Games"]'); if (!n) return null; const r = n.getBoundingClientRect(); return { right: Math.round(r.right), width: Math.round(r.width), vw: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }; });
  const href = await card.locator("a").getAttribute("href");
  console.log(w, JSON.stringify(nav), "play link:", href, "errors:", errors.length);
  await page.context().close();
}
await browser.close();

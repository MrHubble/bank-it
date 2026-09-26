// Screenshots of every layout at desktop and phone sizes.
import { launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const sizes = [["desktop", 1280, 800, 1], ["wide", 1600, 720, 1], ["landscape", 844, 390, 2], ["portrait", 390, 844, 2], ["tablet", 820, 1180, 1]];
const layouts = (process.argv[3] ?? "bin-there,air-mail,flight-risk").split(",");
const browser = await launch();
for (const [name, w, h, dpr] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: name !== "desktop" && name !== "wide", isMobile: name === "landscape" || name === "portrait" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4311/");
  await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  if (process.argv[4] === "title") await page.screenshot({ path: `${out}/z-${name}-title.png` });
  for (const l of layouts) {
    await page.evaluate((l) => window.bankIt.startFreestyle(l), l);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/z-${name}-${l}.png` });
  }
  await ctx.close();
}
await browser.close();

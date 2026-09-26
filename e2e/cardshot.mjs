// The 1200x750 homepage card image: a real frame of play, UI chrome hidden.
import { writeFileSync } from "node:fs";
import { launch } from "./harness.mjs";
const [base, outPng, outWebp] = process.argv.slice(2);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 })).newPage();
await page.goto(base);
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.addStyleTag({ content: ".hud-top, .hud-bottom, #offscreen { display: none !important; }" });
await page.evaluate(() => window.bankIt.startFreestyle("flight-risk"));
await page.waitForTimeout(400);
await page.evaluate(() => window.bankIt.queueShot({ angleTenths: 658, powerTenths: 845 }, 326));
await page.waitForFunction(() => window.bankIt.state().log.sequence.includes("gull"), null, { timeout: 30000, polling: 1 });
await page.evaluate(() => window.bankIt.setTimeScale(0.03));
await page.waitForTimeout(700);
await page.screenshot({ path: outPng });
// Encode WebP in the browser (no image tools needed on the machine).
const webp = await page.evaluate(async () => {
  const shot = document.querySelector("canvas");
  return null;
});
const b64 = await page.evaluate(async (png) => {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  return c.toDataURL("image/webp", 0.84).split(",")[1];
}, (await import("node:fs")).readFileSync(outPng).toString("base64"));
writeFileSync(outWebp, Buffer.from(b64, "base64"));
console.log(JSON.stringify(await page.evaluate(() => window.bankIt.state().log.sequence)));
await browser.close();

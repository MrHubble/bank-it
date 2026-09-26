// Slow-motion close-ups of a prop reacting to a shot.
//   node e2e/closeup.mjs out layout a/p/t x,y,w,h(world) frames(ms of slowed wall time)
import { BASE, launch } from "./harness.mjs";
const [out, layout, shot, box, framesArg, waitFor] = process.argv.slice(2);
const [a, p, t] = shot.split("/").map(Number);
const [bx, by, bw, bh] = box.split(",").map(Number);
const frames = framesArg.split(",").map(Number);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE);
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate((l) => window.bankIt.startFreestyle(l), layout);
await page.evaluate(([aim, tt]) => window.bankIt.queueShot(aim, tt), [{ angleTenths: a, powerTenths: p }, t]);
// Run at normal speed until the ball reaches the prop's box, then crawl.
await page.waitForFunction(([bx, by, bw, bh]) => { const b = window.bankIt.state().ball; const s = window.bankIt.state().phase; return s !== "ready" && b.x > bx - 0.6 && b.x < bx + bw + 0.6 && b.y > by - 0.6 && b.y < by + bh + 0.6; }, [bx, by, bw, bh], { timeout: 30000, polling: 5 });
await page.evaluate(() => window.bankIt.setTimeScale(0.08));
const tl = await page.evaluate(([x, y]) => window.bankIt.toScreen(x, y), [bx, by + bh]);
const br = await page.evaluate(([x, y]) => window.bankIt.toScreen(x, y), [bx + bw, by]);
let last = 0;
for (const [i, f] of frames.entries()) {
  await page.waitForTimeout(f - last);
  last = f;
  await page.screenshot({ path: `${out}/cu-${i}.png`, clip: { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y } });
}
await browser.close();

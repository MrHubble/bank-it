import { launch } from "./harness.mjs";
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto("http://localhost:4311/");
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate(() => window.bankIt.startFreestyle("bin-there"));
await page.evaluate(() => window.bankIt.queueShot({ angleTenths: 450, powerTenths: 700 }, 0));
await page.waitForFunction(() => window.bankIt.state().phase === "resolving", null, { timeout: 30000, polling: 10 });
for (let i = 0; i < 12; i++) {
  const caps = await page.evaluate(() => [...document.querySelectorAll(".caption")].map((c) => { const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); return `${c.textContent} op=${cs.opacity} anim=${cs.animationName}/${cs.animationDuration}/${cs.animationPlayState} rect=${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} vis=${cs.visibility} color=${cs.color}`; }));
  console.log(i * 100, caps.join(" | "));
  await page.waitForTimeout(100);
}
const layer = await page.evaluate(() => { const l = document.getElementById("captions"); const cs = getComputedStyle(l); return `${cs.position} z=${cs.zIndex} ${l.getBoundingClientRect().width}x${l.getBoundingClientRect().height}`; });
console.log("layer", layer);
await browser.close();

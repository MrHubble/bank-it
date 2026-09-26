import { BASE, launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const id = process.argv[3] ?? "return-to-sender";
const frames = (process.argv[4] ?? "600,1200,1800,2400").split(",").map(Number);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + " " + m.text().slice(0, 200)); });
page.on("pageerror", (e) => logs.push("pageerror " + String(e).slice(0, 300)));
await page.goto(BASE, { timeout: 20000 });
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate((id) => window.bankIt.startChallenge(id), id);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/c-${id}-0.png` });
const info = await page.evaluate(() => window.bankIt.state());
console.log("before", info.phase, info.overlay);
// Shoot the recorded solution at the right tick.
const solution = JSON.parse(process.argv[5] ?? "null");
if (solution) {
  await page.evaluate((s) => window.bankIt.setAim(s.aim), solution);
  await page.waitForFunction((t) => window.bankIt.state().phaseTick >= t, solution.releaseTick, { polling: 1 });
  await page.evaluate(() => window.bankIt.shoot());
}
let last = 0;
for (const [i, f] of frames.entries()) {
  await page.waitForTimeout(f - last);
  last = f;
  await page.screenshot({ path: `${out}/c-${id}-${i + 1}.png` });
}
const st = await page.evaluate(() => { const s = window.bankIt.state(); return { phase: s.phase, overlay: s.overlay, seq: s.log.sequence, scored: s.log.scored }; });
console.log(JSON.stringify(st));
console.log(logs.slice(0, 8).join("\n"));
await browser.close();

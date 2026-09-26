import { BASE, launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const [a, p, t] = (process.argv[3] ?? "780/660/461").split("/").map(Number);
const frames = (process.argv[4] ?? "700,1000,1500,2300,3000").split(",").map(Number);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + " " + m.text().slice(0, 200)); });
page.on("pageerror", (e) => logs.push("pageerror " + String(e).slice(0, 300)));
await page.goto(BASE, { timeout: 20000 });
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate(() => window.bankIt.startFreestyle("flight-risk"));
await page.evaluate(([aim, tt]) => window.bankIt.queueShot(aim, tt), [{ angleTenths: a, powerTenths: p }, t]);
await page.waitForFunction(() => window.bankIt.state().phase !== "ready", null, { polling: 5, timeout: 20000 });
console.log("released at", await page.evaluate(() => window.bankIt.lastRelease()));
let last = 0;
for (const [i, f] of frames.entries()) {
  await page.waitForTimeout(f - last);
  last = f;
  await page.screenshot({ path: `${out}/b-${i + 1}.png` });
}
console.log(JSON.stringify(await page.evaluate(() => { const s = window.bankIt.state(); return { phase: s.phase, seq: s.log.sequence, scored: s.log.scored, score: s.mode.score }; })));
console.log(logs.slice(0, 8).join("\n"));
await browser.close();

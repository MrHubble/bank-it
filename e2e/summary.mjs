import { launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto("http://localhost:4311/");
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.setItem("bankit.v1.best.air-mail", JSON.stringify({ score: 1500, chain: [], chainScore: 0 })); window.bankIt.startFreestyle("air-mail"); window.bankIt.setTimeScale(3); });
const shots = [[464, 775], [144, 347], [239, 359], [199, 749], [300, 300], [464, 775], [144, 347], [239, 359], [199, 749], [464, 775]];
for (const [a, p] of shots) {
  await page.waitForFunction(() => window.bankIt.state().phase === "ready", null, { timeout: 30000, polling: 20 });
  await page.evaluate(([a, p]) => window.bankIt.queueShot({ angleTenths: a, powerTenths: p }, 0), [a, p]);
  await page.waitForFunction(() => window.bankIt.state().phase !== "ready", null, { timeout: 30000, polling: 20 });
}
await page.waitForFunction(() => window.bankIt.state().overlay === "summary", null, { timeout: 60000, polling: 50 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/summary.png` });
console.log(JSON.stringify(await page.evaluate(() => { const s = window.bankIt.state(); return { score: s.mode.score, baskets: s.mode.baskets, best: s.mode.bestChain }; })));
await browser.close();

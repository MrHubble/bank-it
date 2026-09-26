import { launch } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const [a, p, t] = (process.argv[3] ?? "658/845/326").split("/").map(Number);
const layout = process.argv[4] ?? "flight-risk";
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto("http://localhost:4311/");
await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
await page.evaluate((l) => window.bankIt.startFreestyle(l), layout);
await page.evaluate(([aim, tt]) => window.bankIt.queueShot(aim, tt), [{ angleTenths: a, powerTenths: p }, t]);
await page.waitForFunction(() => window.bankIt.state().phase === "resolving", null, { timeout: 30000, polling: 10 });
for (const [i, d] of [180, 420, 800].entries()) {
  await page.waitForTimeout(i === 0 ? d : d - [180, 420, 800][i - 1]);
  await page.screenshot({ path: `${out}/cel-${i}.png` });
}
await browser.close();

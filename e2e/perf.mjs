import { BASE, launch } from "./harness.mjs";
const browser = await launch();
for (const [w, h, dpr] of [[1280, 800, 1], [844, 390, 3]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })).newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
  for (const l of ["bin-there", "air-mail", "flight-risk"]) {
    await page.evaluate((l) => window.bankIt.startFreestyle(l), l);
    await page.waitForTimeout(400);
    console.log(w, h, dpr, l, JSON.stringify(await page.evaluate(() => window.bankIt.memory())));
  }
  // Frame timing (software renderer, so only a relative guide).
  const ft = await page.evaluate(() => new Promise((res) => { const ts = []; let n = 0; const f = (t) => { ts.push(t); if (++n < 60) requestAnimationFrame(f); else res((ts[ts.length - 1] - ts[0]) / (ts.length - 1)); }; requestAnimationFrame(f); }));
  console.log("avg frame ms (swiftshader)", ft.toFixed(1));
  await page.context().close();
}
await browser.close();

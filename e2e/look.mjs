import { launch, openGame, serve } from "./harness.mjs";
const out = process.argv[2] ?? "/tmp";
const server = await serve("dist", 4311);
const browser = await launch();
try {
  const { page, errors } = await openGame(browser, "http://localhost:4311/");
  await page.screenshot({ path: `${out}/title.png` });
  await page.click("text=Freestyle");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/pick.png` });
  await page.click("[data-id=bin-there]");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/play.png` });
  console.log(JSON.stringify(await page.evaluate(() => window.bankIt.state()), null, 0).slice(0, 600));
  console.log("errors:", errors);
} finally {
  await browser.close();
  server.kill();
}

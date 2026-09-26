// End-to-end checks in Chromium. Prints PASS/FAIL per check.
//   node e2e/verify.mjs http://localhost:4311/ [outDir]
import { launch } from "./harness.mjs";
const base = process.argv[2] ?? "http://localhost:4311/";
const out = process.argv[3] ?? "/tmp";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const browser = await launch();

async function open(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 800 }, hasTouch: !!opts.touch, isMobile: !!opts.mobile, reducedMotion: opts.reducedMotion ?? "no-preference" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => window.bankIt.state());
const waitPhase = (page, phase, timeout = 20000) => page.waitForFunction((p) => window.bankIt.state().phase === p, phase, { timeout, polling: 20 });

// ---------------------------------------------------------------- basics
{
  const { context, page, errors } = await open();
  const s0 = await st(page);
  check("title screen on load", s0.overlay === "title" && s0.phase === "idle");
  check("audio waits for a user gesture", (await page.evaluate(() => window.bankIt.audio())) === "none");
  await page.click("text=Freestyle");
  await page.click("[data-id=bin-there]");
  await waitPhase(page, "ready");
  check("audio starts after interaction", (await page.evaluate(() => window.bankIt.audio())) === "running");

  // Keyboard aim and shoot.
  await page.evaluate(() => window.bankIt.setAim({ angleTenths: 450, powerTenths: 700 }));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Shift");
  await page.keyboard.press("ArrowDown");
  let s = await st(page);
  check("keyboard nudges angle and power", s.aim.angleTenths === 461 && s.aim.powerTenths === 696, JSON.stringify(s.aim));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  s = await st(page);
  check("keyboard nudges back", s.aim.angleTenths === 456 && s.aim.powerTenths === 701, JSON.stringify(s.aim));
  await page.evaluate(() => window.bankIt.setAim({ angleTenths: 450, powerTenths: 700 }));
  await page.keyboard.press("Space");
  s = await st(page);
  check("Space shoots", s.phase === "flying" && s.mode.shotsLeft === 9);
  await page.waitForFunction(() => window.bankIt.state().mode.score === 100, null, { timeout: 10000 }).then(() => check("direct basket scores 100", true), () => check("direct basket scores 100", false));
  await waitPhase(page, "ready");
  check("aim kept between shots", JSON.stringify((await st(page)).aim) === JSON.stringify({ angleTenths: 450, powerTenths: 700 }));

  // Retry mid-flight consumes the shot exactly once.
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("r");
  s = await st(page);
  check("retry mid-flight returns to ready", s.phase === "ready");
  check("retry mid-flight uses exactly one shot", s.mode.shotsLeft === 8, `left ${s.mode.shotsLeft}`);
  await page.keyboard.press("r");
  s = await st(page);
  check("retry while aiming uses no shot", s.mode.shotsLeft === 8);

  // Mouse drag, cancel by returning to the start.
  const ball = await page.evaluate(() => { const l = window.bankIt.launch(); return window.bankIt.toScreen(l.x, l.y); });
  const before = (await st(page)).aim;
  await page.mouse.move(ball.x, ball.y);
  await page.mouse.down();
  await page.mouse.move(ball.x - 80, ball.y + 60, { steps: 4 });
  const during = (await st(page)).aim;
  await page.mouse.move(ball.x - 3, ball.y + 2, { steps: 4 });
  await page.mouse.up();
  s = await st(page);
  check("drag changes aim while pulling", during.angleTenths !== before.angleTenths || during.powerTenths !== before.powerTenths);
  check("releasing in the dead zone cancels", s.phase === "ready" && s.mode.shotsLeft === 8 && JSON.stringify(s.aim) === JSON.stringify(before));

  // Escape cancels a drag.
  await page.mouse.move(ball.x, ball.y);
  await page.mouse.down();
  await page.mouse.move(ball.x - 90, ball.y + 70, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  s = await st(page);
  check("Escape cancels a drag", s.phase === "ready" && s.mode.shotsLeft === 8 && JSON.stringify(s.aim) === JSON.stringify(before) && s.overlay === null);

  // Mouse drag shot.
  await page.mouse.move(ball.x, ball.y);
  await page.mouse.down();
  await page.mouse.move(ball.x - 100, ball.y + 95, { steps: 6 });
  await page.mouse.up();
  s = await st(page);
  check("mouse drag shoots", s.phase === "flying" && s.mode.shotsLeft === 7);
  await page.keyboard.press("r");

  // Ghost and mute toggles persist.
  await page.keyboard.press("g");
  await page.click("#btn-sound");
  s = await st(page);
  check("ghost and mute toggle", s.ghost === false && s.muted === true);
  await page.reload();
  await page.waitForFunction(() => !!window.bankIt);
  s = await st(page);
  check("ghost and mute persist after reload", s.ghost === false && s.muted === true);
  await page.evaluate(() => window.bankIt.startFreestyle("bin-there"));
  await page.keyboard.press("g");
  await page.keyboard.press("m");
  s = await st(page);
  check("toggles restore", s.ghost === true && s.muted === false);
  check("no page errors (basics)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// ------------------------------------------------------------ full round
{
  const { context, page, errors } = await open();
  await page.evaluate(() => { localStorage.clear(); window.bankIt.startFreestyle("bin-there"); });
  for (let i = 0; i < 10; i++) {
    await waitPhase(page, "ready");
    await page.evaluate(() => window.bankIt.queueShot({ angleTenths: 450, powerTenths: 700 }, 0));
    await page.waitForFunction(() => window.bankIt.state().phase !== "ready", null, { timeout: 10000 });
    // Skip the celebration after the basket.
    await page.waitForFunction(() => window.bankIt.state().phase === "resolving", null, { timeout: 10000 });
    await page.keyboard.press("Space");
  }
  await page.waitForFunction(() => window.bankIt.state().overlay === "summary", null, { timeout: 10000 });
  const s = await st(page);
  check("round of ten ends in a summary", s.overlay === "summary" && s.mode.shotsLeft === 0);
  check("ten direct baskets score 1,000", s.mode.score === 1000, String(s.mode.score));
  await page.screenshot({ path: `${out}/v-summary.png` });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("bankit.v1.best.bin-there") ?? "null"));
  check("best score saved per layout", saved?.score === 1000);
  await page.click("[data-action=replay]");
  const r = await st(page);
  check("play again starts a fresh round immediately", r.phase === "ready" && r.mode.shotsLeft === 10 && r.mode.score === 0);
  const other = await page.evaluate(() => localStorage.getItem("bankit.v1.best.air-mail"));
  check("other layouts keep their own best", other === null);
  check("no page errors (round)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// ------------------------------------------------------- every called shot
{
  const { context, page, errors } = await open();
  await page.evaluate(() => localStorage.clear());
  const list = await page.evaluate(() => window.bankIt.challenges());
  for (const c of list) {
    await page.evaluate((id) => window.bankIt.startChallenge(id), c.id);
    await waitPhase(page, "ready");
    await page.evaluate((sol) => window.bankIt.queueShot(sol.aim, sol.releaseTick), c.solution);
    const ok = await page
      .waitForFunction(() => window.bankIt.state().overlay === "complete", null, { timeout: 20000, polling: 50 })
      .then(() => true, () => false);
    const s = await st(page);
    check(`called shot ${c.number} "${c.title}" made in the browser`, ok, ok ? "" : `seq ${s.log.sequence.join(">")} scored ${s.log.scored}`);
  }
  const bests = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bankit.v1.challenge.")).length);
  check("best attempt counts saved", bests === list.length, `${bests}/${list.length}`);
  check("no page errors (challenges)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// ------------------------------------------ mode switching and resources
{
  const { context, page, errors } = await open();
  await page.evaluate(() => window.bankIt.startFreestyle("bin-there"));
  await page.waitForTimeout(300);
  const m0 = await page.evaluate(() => window.bankIt.memory());
  for (let i = 0; i < 4; i++) {
    for (const id of ["air-mail", "flight-risk", "bin-there"]) {
      await page.evaluate((id) => window.bankIt.startFreestyle(id), id);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.bankIt.startChallenge("boing"));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.bankIt.startFreestyle("bin-there"));
    await page.waitForTimeout(120);
  }
  const m1 = await page.evaluate(() => window.bankIt.memory());
  check("switching modes and layouts doesn't leak", m1.geometries <= m0.geometries + 2 && m1.textures <= m0.textures + 1 && m1.objects === m0.objects && m1.canvases === 1, `${JSON.stringify(m0)} -> ${JSON.stringify(m1)}`);

  // Pause while hidden: no ticks advance, no jump on return.
  await waitPhase(page, "ready");
  const t0 = (await st(page)).phaseTick;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const t1 = (await st(page)).phaseTick;
  await page.waitForTimeout(1500);
  const t2 = (await st(page)).phaseTick;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  const t3 = (await st(page)).phaseTick;
  check("simulation pauses while the tab is hidden", t2 === t1 && t1 >= t0, `${t0} ${t1} ${t2}`);
  check("no catch-up jump when the tab returns", t3 - t2 < 60, `advanced ${t3 - t2} ticks in 250 ms`);

  // Resize to phone sizes and back.
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const s = await st(page);
    const canvas = await page.evaluate(() => { const c = document.querySelector("canvas"); return { w: c.clientWidth, h: c.clientHeight }; });
    check(`resize to ${w}x${h}`, canvas.w === w && canvas.h === h && s.pxPerMetre > 10, `px/m ${s.pxPerMetre.toFixed(1)}`);
  }
  check("no page errors (modes)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// ------------------------------------------------------ touch and phones
{
  const { context, page, errors } = await open({ viewport: { width: 844, height: 390 }, touch: true, mobile: true });
  await page.evaluate(() => window.bankIt.startFreestyle("air-mail"));
  await waitPhase(page, "ready");
  const ball = await page.evaluate(() => { const l = window.bankIt.launch(); return window.bankIt.toScreen(l.x, l.y); });
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await touch("touchStart", ball.x, ball.y);
  for (let i = 1; i <= 6; i++) await touch("touchMove", ball.x - i * 14, ball.y + i * 12);
  const mid = await st(page);
  await touch("touchEnd", 0, 0);
  const s = await st(page);
  check("touch drag aims", mid.aim.angleTenths > 300 && mid.aim.angleTenths < 600, JSON.stringify(mid.aim));
  check("touch release shoots", s.phase === "flying" && s.mode.shotsLeft === 9);
  await page.screenshot({ path: `${out}/v-phone-landscape.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/v-phone-portrait.png` });
  check("no page errors (touch)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// ------------------------------------------------------- reduced motion
{
  const { context, page } = await open({ reducedMotion: "reduce" });
  const on = await page.evaluate(() => document.documentElement.classList.contains("reduced-motion"));
  check("respects prefers-reduced-motion", on);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

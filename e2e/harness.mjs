// Tiny Playwright harness for looking at and driving the game in Chromium.
// Uses Playwright (installed globally or locally) and its bundled Chromium.
// Start a server first, e.g. `npm run build && npx vite preview --port 4311`.
export const BASE = process.env.BANKIT_URL ?? "http://localhost:4311/";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/node22/lib/node_modules/playwright");
}
export const { chromium, devices } = pw;

export async function launch() {
  return chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
}

export async function openGame(browser, url, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 800 }, deviceScaleFactor: opts.dpr ?? 1, hasTouch: !!opts.touch, isMobile: !!opts.mobile });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.bankIt, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return { context, page, errors };
}

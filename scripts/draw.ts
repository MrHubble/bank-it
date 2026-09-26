// Plot a layout's colliders and some shots to an SVG (and a PNG when Chromium
// is available). Used while designing layouts.
//
//   node scripts/draw.ts bin-there out.svg 580/880 440/920/0 ...
// Each shot is angleTenths/powerTenths[/releaseTick].
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { layoutById } from "../src/levels/layouts.ts";
import { birdPosition } from "../src/props/bird.ts";
import { VIEW_RECT } from "../src/sim/constants.ts";
import { loadRapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";
import { buildWorld } from "../src/sim/world.ts";
import { applyPatch } from "./patch.ts";

const argv = process.argv.slice(2);
const pi = argv.indexOf("--patch");
const patch = pi >= 0 ? argv.splice(pi, 2)[1] : "";
const [layoutId, outFile, ...shotSpecs] = argv;
const R = await loadRapier();
const layout = applyPatch(layoutById(layoutId), patch);
const S = 60;
const W = (VIEW_RECT.maxX - VIEW_RECT.minX + 2) * S;
const H = (VIEW_RECT.maxY - VIEW_RECT.minY + 1.5) * S;
const X = (x: number) => ((x - VIEW_RECT.minX + 1) * S).toFixed(1);
const Y = (y: number) => (H - (y - VIEW_RECT.minY + 0.5) * S).toFixed(1);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#eef6ff;font:12px monospace">`;
// grid
for (let x = 0; x <= 17; x++) svg += `<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}" stroke="#d8e4f0"/><text x="${X(x)}" y="${H - 4}">${x}</text>`;
for (let y = 0; y <= 9; y++) svg += `<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}" stroke="#d8e4f0"/><text x="2" y="${Y(y)}">${y}</text>`;
const built = buildWorld(R, layout, { staticOnly: false, startPhase: 0 });
const dbg = built.world.debugRender();
const v = dbg.vertices;
for (let i = 0; i < v.length; i += 4) svg += `<line x1="${X(v[i])}" y1="${Y(v[i + 1])}" x2="${X(v[i + 2])}" y2="${Y(v[i + 3])}" stroke="#222" stroke-width="2"/>`;
built.world.free();
for (const d of layout.props) {
  if (d.type === "bird") {
    let pts = "";
    for (let t = 0; t < d.path.period; t += 6) {
      const p = birdPosition(d.path, t);
      pts += `${X(p.x)},${Y(p.y)} `;
    }
    svg += `<polyline points="${pts}" fill="none" stroke="#999" stroke-dasharray="4 4"/>`;
  }
}
svg += `<circle cx="${X(layout.launch.x)}" cy="${Y(layout.launch.y)}" r="${0.24 * S}" fill="orange" stroke="#000"/>`;
const colors = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#46a0a0", "#f032e6", "#808000", "#000075", "#9a6324"];
shotSpecs.forEach((spec, i) => {
  const [a, p, t] = spec.split("/").map(Number);
  const res = runShot(R, { layout, aim: { angleTenths: a, powerTenths: p }, releaseTick: t || 0 }, { recordPath: true, afterScoreTicks: 20 });
  const c = colors[i % colors.length];
  svg += `<polyline points="${res.path.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2" opacity="0.85"/>`;
  const imp = res.events.filter((e) => e.type === "impact").map((e) => (e.type === "impact" ? e.objectId : "")).join(">");
  svg += `<text x="10" y="${16 + i * 15}" fill="${c}">${spec}: ${res.endReason} ${imp}</text>`;
});
svg += "</svg>";
mkdirSync(dirname(resolve(outFile)), { recursive: true });
writeFileSync(outFile, svg);
const html = outFile.replace(/\.svg$/, ".html");
writeFileSync(html, `<!doctype html><html><body style="margin:0;overflow:hidden">${svg}</body></html>`);
const chrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (existsSync(chrome)) {
  const png = outFile.replace(/\.svg$/, ".png");
  execFileSync(chrome, ["--headless", "--no-sandbox", "--disable-gpu", `--screenshot=${resolve(png)}`, `--window-size=${Math.round(W)},${Math.round(H) + 90}`, `file://${resolve(html)}`], { stdio: "ignore" });
  console.log(`wrote ${png}`);
}

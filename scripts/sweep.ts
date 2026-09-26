// Headless shot sweeper used to design the layouts and find Called Shot
// solutions. It fires a grid of shots through the real simulation and groups
// the baskets by route.
//
//   node scripts/sweep.ts bin-there --angles 200:1500:5 --powers 0:1000:5 [--ticks 0] [--out sweeps/bin-there.json]
//
// Angles and powers are in tenths (523 = 52.3°, 785 = 78.5%). Ticks are the
// release timing in simulation ticks after an attempt starts (for the bird).
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname } from "node:path";
import { Worker } from "node:worker_threads";
import type { SweepHit } from "./sweep-worker.ts";

function range(spec: string): number[] {
  const [a, b, s] = spec.split(":").map(Number);
  const out: number[] = [];
  for (let v = a; v <= b; v += s || 1) out.push(v);
  return out;
}

const args = process.argv.slice(2);
const layoutId = args[0] ?? "bin-there";
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const angles = range(opt("angles", "100:1700:10"));
const powers = range(opt("powers", "0:1000:10"));
const ticks = range(opt("ticks", "0:0:1"));
const out = opt("out", "");
const patch = opt("patch", "");
const workers = Math.max(1, Math.min(cpus().length, 8));

const t0 = Date.now();
const chunks: number[][] = Array.from({ length: workers }, () => []);
angles.forEach((a, i) => chunks[i % workers].push(a));
const results = await Promise.all(
  chunks
    .filter((c) => c.length)
    .map(
      (chunk) =>
        new Promise<{ hits: SweepHit[]; shots: number }>((resolve, reject) => {
          const w = new Worker(new URL("./sweep-worker.ts", import.meta.url), {
            workerData: { layoutId, angles: chunk, powers, ticks, patch },
          });
          w.once("message", resolve);
          w.once("error", reject);
        }),
    ),
);
const hits = results.flatMap((r) => r.hits);
const shots = results.reduce((s, r) => s + r.shots, 0);
console.log(`${layoutId}: ${shots} shots, ${hits.length} baskets in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const key = (h: SweepHit) => `${h.t}/${h.a}/${h.p}`;
const byKey = new Map(hits.map((h) => [key(h), h]));
const da = angles.length > 1 ? angles[1] - angles[0] : 1;
const dp = powers.length > 1 ? powers[1] - powers[0] : 1;
function robustness(h: SweepHit): number {
  let n = 0;
  for (const [x, y] of [
    [da, 0],
    [-da, 0],
    [0, dp],
    [0, -dp],
    [da, dp],
    [-da, -dp],
    [da, -dp],
    [-da, dp],
  ]) {
    const o = byKey.get(`${h.t}/${h.a + x}/${h.p + y}`);
    if (o && o.route === h.route) n++;
  }
  return n;
}

const routes = new Map<string, SweepHit[]>();
for (const h of hits) {
  const k = h.route || "(direct)";
  if (!routes.has(k)) routes.set(k, []);
  routes.get(k)!.push(h);
}
const sorted = [...routes.entries()].sort((x, y) => y[1].length - x[1].length);
for (const [route, list] of sorted) {
  const best = [...list].sort((x, y) => robustness(y) - robustness(x))[0];
  const objs = route === "(direct)" ? 0 : route.split(">").length;
  console.log(
    `${String(list.length).padStart(5)}  [${objs}] ${route.padEnd(48)} best a=${best.a} p=${best.p} t=${best.t} robust=${robustness(best)}/8 score=${best.score}`,
  );
}
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ layoutId, angles, powers, ticks, hits }, null, 0));
  console.log(`wrote ${out}`);
}

// Find a forgiving solution for a Called Shot requirement.
//
// Takes candidate shots from a sweep (JSON written with `sweep.ts --out`),
// then searches a fine grid (0.1° / 0.1% steps, and release ticks when the
// seagull is involved) around the best candidates. Each point's forgiveness is
// how many neighbours within two fine steps also make the challenge; the most
// forgiving point wins.
//
//   node scripts/solve.ts sweeps/air-mail.json --seq roof,umbrella,backboard
//   node scripts/solve.ts sweeps/flight-risk.json --need gull --seeds 16
import { readFileSync } from "node:fs";
import { layoutById } from "../src/levels/layouts.ts";
import { challengeComplete, type Requirement } from "../src/rules/challenges.ts";
import { logEvent, newShotLog } from "../src/rules/shotLog.ts";
import { loadRapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";
import type { SweepHit } from "./sweep-worker.ts";
import { applyPatch } from "./patch.ts";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const file = args[0];
const data = JSON.parse(readFileSync(file, "utf8")) as { layoutId: string; hits: SweepHit[] };
const layout = applyPatch(layoutById(data.layoutId), opt("patch", ""));
const need = opt("need", "").split(",").filter(Boolean);
const seq = opt("seq", "").split(",").filter(Boolean);
const swish = args.includes("--swish");
// --exact: the eligible route must be exactly the --seq objects, nothing else.
const exact = args.includes("--exact");
const req: Requirement = swish ? { kind: "swish" } : seq.length ? { kind: "sequence", objects: seq } : { kind: "all", objects: need };
const seedsWanted = Number(opt("seeds", "10"));
const radius = Number(opt("radius", "6"));
const tickRadius = Number(opt("tick-radius", "2"));
// How far either side to measure release-timing forgiveness, and how much it counts.
const timeSpan = Number(opt("time-span", "2"));
const timeWeight = Number(opt("time-weight", "3"));
const hasBird = layout.props.some((p) => p.type === "bird");

const R = await loadRapier();
const cache = new Map<string, boolean>();
function makes(a: number, p: number, t: number): boolean {
  const key = `${a}/${p}/${t}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const res = runShot(R, { layout, aim: { angleTenths: a, powerTenths: p }, releaseTick: t });
  const log = newShotLog();
  for (const e of res.events) logEvent(log, e);
  const ok = challengeComplete(req, log) && (!exact || log.sequence.join(">") === seq.join(">"));
  cache.set(key, ok);
  return ok;
}

// Seeds: matching sweep hits, spread out (one per coarse cell).
const matching = data.hits.filter((h) => {
  const r = h.route ? h.route.split(">") : [];
  if (req.kind === "swish") return h.swish;
  if (exact) return h.route === seq.join(">");
  if (req.kind === "all") return req.objects.every((o) => r.includes(o));
  let i = 0;
  for (const id of r) if (id === req.objects[i]) i++;
  return i === req.objects.length;
});
const byCell = new Map<string, SweepHit[]>();
for (const h of matching) {
  const k = `${Math.round(h.a / 30)}/${Math.round(h.p / 30)}/${Math.round(h.t / 30)}`;
  if (!byCell.has(k)) byCell.set(k, []);
  byCell.get(k)!.push(h);
}
const seeds = [...byCell.values()].sort((x, y) => y.length - x.length).slice(0, seedsWanted).map((g) => g[Math.floor(g.length / 2)]);
console.log(`${matching.length} matching sweep hits, ${byCell.size} clusters, refining ${seeds.length}`);

interface Best {
  a: number;
  p: number;
  t: number;
  aimScore: number;
  timeScore: number;
}
let best = null as Best | null;
for (const s of seeds) {
  const ticks = hasBird ? Array.from({ length: tickRadius * 2 + 1 }, (_, i) => s.t - tickRadius + i).filter((t) => t >= 0) : [s.t];
  for (const t of ticks) {
    for (let a = s.a - radius; a <= s.a + radius; a++) {
      for (let p = s.p - radius; p <= s.p + radius; p++) {
        if (!makes(a, p, t)) continue;
        // Forgiveness in aim: neighbours within two fine steps.
        let aimScore = 0;
        for (let da = -2; da <= 2; da++) for (let dp = -2; dp <= 2; dp++) if ((da || dp) && makes(a + da, p + dp, t)) aimScore++;
        let timeScore = 0;
        if (hasBird) {
          // Contiguous run of good release ticks around t.
          for (let dt = 1; dt <= timeSpan && makes(a, p, t + dt); dt++) timeScore++;
          for (let dt = 1; dt <= timeSpan && t - dt >= 0 && makes(a, p, t - dt); dt++) timeScore++;
        }
        const total = aimScore + timeScore * timeWeight;
        const bestTotal = best ? best.aimScore + best.timeScore * timeWeight : -1;
        if (total > bestTotal) best = { a, p, t, aimScore, timeScore };
      }
    }
  }
  if (best && best.aimScore >= 24 && (!hasBird || best.timeScore === timeSpan * 2)) break;
}
console.log(`${cache.size} shots simulated`);
if (!best) {
  console.log("no solution found");
  process.exit(1);
}
console.log(
  `best: angleTenths=${best.a} powerTenths=${best.p} releaseTick=${best.t}  aim forgiveness ${best.aimScore}/24${hasBird ? `  timing ${best.timeScore}/${timeSpan * 2}` : ""}`,
);

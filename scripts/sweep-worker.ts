import { parentPort, workerData } from "node:worker_threads";
import { layoutById } from "../src/levels/layouts.ts";
import { logEvent, newShotLog } from "../src/rules/shotLog.ts";
import { scoreChain } from "../src/rules/scoring.ts";
import { loadRapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";
import { birdPosition } from "../src/props/bird.ts";
import { applyPatch } from "./patch.ts";

export interface SweepJob {
  layoutId: string;
  patch?: string;
  /** Only try release ticks where the bird can meet the ball (step between candidate ticks). */
  smartBird?: number;
  angles: number[];
  powers: number[];
  ticks: number[];
}

export interface SweepHit {
  a: number;
  p: number;
  t: number;
  route: string;
  score: number;
  ground: boolean;
  bird: boolean;
  swish: boolean;
  impacts: string;
}

const job = workerData as SweepJob;
const R = await loadRapier();
const layout = applyPatch(layoutById(job.layoutId), job.patch);
const hits: SweepHit[] = [];
let shots = 0;
const record = (a: number, p: number, t: number, res: ReturnType<typeof runShot>) => {
  if (!res.scored) return;
  const log = newShotLog();
  for (const e of res.events) logEvent(log, e);
  hits.push({
    a,
    p,
    t,
    route: log.sequence.join(">"),
    score: scoreChain(log).total,
    ground: log.groundBounce,
    bird: log.birdHit,
    swish: log.impacts.length === 0,
    impacts: log.impacts.map((i) => i.objectId).join(">"),
  });
};
if (job.smartBird) {
  // Fly the shot without the bird, then only replay release ticks where the
  // gull's patrol actually crosses the ball's path.
  const birds = layout.props.filter((d) => d.type === "bird");
  const noBird = { ...layout, props: layout.props.filter((d) => d.type !== "bird") };
  for (const a of job.angles) {
    for (const p of job.powers) {
      const free = runShot(R, { layout: noBird, aim: { angleTenths: a, powerTenths: p }, releaseTick: 0 }, { recordPath: true });
      shots++;
      for (const b of birds) {
        if (b.type !== "bird") continue;
        const P = b.path.period;
        const reach = (b.radius + 0.24 + 0.05) ** 2;
        const cands = new Set<number>();
        for (let k = 1; k < free.path.length; k++) {
          const q = free.path[k];
          if (q.y < b.path.y - 1.2 || q.y > b.path.y + 1.2) continue;
          for (let phi = 0; phi < P; phi += job.smartBird) {
            const c = birdPosition(b.path, phi);
            const dx = c.x - q.x;
            const dy = c.y - q.y;
            if (dx * dx + dy * dy < reach) cands.add((((phi - k) % P) + P) % P);
          }
        }
        for (const t of cands) {
          shots++;
          record(a, p, t, runShot(R, { layout, aim: { angleTenths: a, powerTenths: p }, releaseTick: t }));
        }
      }
    }
  }
  parentPort!.postMessage({ hits, shots });
  process.exit(0);
}
for (const t of job.ticks) {
  for (const a of job.angles) {
    for (const p of job.powers) {
      shots++;
      const res = runShot(R, { layout, aim: { angleTenths: a, powerTenths: p }, releaseTick: t });
      if (!res.scored) continue;
      const log = newShotLog();
      for (const e of res.events) logEvent(log, e);
      hits.push({
        a,
        p,
        t,
        route: log.sequence.join(">"),
        score: scoreChain(log).total,
        ground: log.groundBounce,
        bird: log.birdHit,
        swish: log.impacts.length === 0,
        impacts: log.impacts.map((i) => i.objectId).join(">"),
      });
    }
  }
}
parentPort!.postMessage({ hits, shots });

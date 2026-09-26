import { parentPort, workerData } from "node:worker_threads";
import { layoutById } from "../src/levels/layouts.ts";
import { logEvent, newShotLog } from "../src/rules/shotLog.ts";
import { scoreChain } from "../src/rules/scoring.ts";
import { loadRapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";
import { applyPatch } from "./patch.ts";

export interface SweepJob {
  layoutId: string;
  patch?: string;
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

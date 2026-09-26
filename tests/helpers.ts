import type { ImpactEvent, SimEvent } from "../src/sim/types.ts";
import { logEvent, newShotLog, type ShotLog } from "../src/rules/shotLog.ts";

const KIND: Record<string, string> = {
  roof: "roof",
  shed: "roof",
  bin: "bin",
  recycling: "bin",
  trampoline: "trampoline",
  umbrella: "umbrella",
  gull: "bird",
  backboard: "backboard",
  ground: "ground",
  rim: "rim",
  garage: "wall",
};
const INELIGIBLE = new Set(["ground", "rim", "wall", "pole"]);

let tick = 0;
export function impact(objectId: string): ImpactEvent {
  const kind = KIND[objectId] ?? objectId;
  tick += 1;
  return {
    type: "impact",
    tick,
    objectId,
    kind,
    part: "x",
    eligible: !INELIGIBLE.has(kind),
    point: { x: 0, y: 0 },
    normal: { x: 0, y: 1 },
    speed: 5,
  };
}

export function basket(swish = false): SimEvent {
  tick += 1;
  return { type: "basket", tick, swish, point: { x: 0, y: 0 } };
}

/** Build a log from a compact route: "roof > bin > BASKET". */
export function play(route: string): ShotLog {
  const log = newShotLog();
  for (const step of route.split(">").map((s) => s.trim()).filter(Boolean)) {
    logEvent(log, step === "BASKET" ? basket() : impact(step));
  }
  return log;
}

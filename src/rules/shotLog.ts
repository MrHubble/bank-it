import type { ImpactEvent, SimEvent } from "../sim/types.ts";

// Keeps track of what the ball hit during one shot, in order.
//
// The simulation already reports one impact per fresh contact with an object
// (a ball rolling along a roof is one contact, not dozens). On top of that,
// back-to-back impacts on the same object are merged, because a ball that
// skips along a surface is still one visit. Visiting an object again after
// something else in between is kept, so ordered challenges can see
// ROOF → BIN → ROOF as three separate impacts.

export interface LoggedImpact {
  objectId: string;
  kind: string;
  eligible: boolean;
  tick: number;
}

export interface ShotLog {
  /** Every separate impact, including ground and rim, in order. */
  impacts: LoggedImpact[];
  /** Separate impacts on eligible objects only, in order. */
  sequence: string[];
  /** Distinct eligible objects in order of first contact. */
  distinct: string[];
  /** Kinds of the distinct objects, parallel to `distinct`. */
  distinctKinds: string[];
  birdHit: boolean;
  groundBounce: boolean;
  rimTouches: number;
  boardTouched: boolean;
  scored: boolean;
  swish: boolean;
}

export function newShotLog(): ShotLog {
  return {
    impacts: [],
    sequence: [],
    distinct: [],
    distinctKinds: [],
    birdHit: false,
    groundBounce: false,
    rimTouches: 0,
    boardTouched: false,
    scored: false,
    swish: false,
  };
}

/**
 * Fold one simulation event into the log. Returns true when a new distinct
 * eligible object joined the chain. Events after the basket are ignored, so a
 * ball bouncing on the driveway after it drops through the net changes nothing.
 */
export function logEvent(log: ShotLog, e: SimEvent): boolean {
  if (log.scored) return false;
  if (e.type === "basket") {
    log.scored = true;
    log.swish = e.swish;
    return false;
  }
  if (e.type !== "impact") return false;
  return logImpact(log, e);
}

function logImpact(log: ShotLog, e: ImpactEvent): boolean {
  const last = log.impacts[log.impacts.length - 1];
  if (e.kind === "rim") log.rimTouches += 1;
  if (e.kind === "ground") log.groundBounce = true;
  if (e.kind === "backboard") log.boardTouched = true;
  if (last && last.objectId === e.objectId) return false;
  log.impacts.push({ objectId: e.objectId, kind: e.kind, eligible: e.eligible, tick: e.tick });
  if (!e.eligible) return false;
  if (log.sequence[log.sequence.length - 1] !== e.objectId) log.sequence.push(e.objectId);
  if (e.kind === "bird") log.birdHit = true;
  if (log.distinct.includes(e.objectId)) return false;
  log.distinct.push(e.objectId);
  log.distinctKinds.push(e.kind);
  return true;
}

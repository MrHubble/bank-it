import type { ShotLog } from "./shotLog.ts";

// Trick-shot scoring:
//   basket                          100
//   each distinct eligible object  +100
//   bird deflection                +200 precision bonus
//   ground bounce                   +50 (once per shot)
//   then × max(1, distinct eligible objects)
// A miss earns nothing: points are only banked when the ball goes in.

export const BASKET_POINTS = 100;
export const OBJECT_POINTS = 100;
export const BIRD_BONUS = 200;
export const GROUND_BONUS = 50;

export interface ShotScore {
  objects: number;
  base: number;
  objectPoints: number;
  birdBonus: number;
  groundBonus: number;
  subtotal: number;
  multiplier: number;
  total: number;
}

export function scoreChain(chain: Pick<ShotLog, "distinct" | "birdHit" | "groundBounce">): ShotScore {
  const objects = chain.distinct.length;
  const objectPoints = objects * OBJECT_POINTS;
  const birdBonus = chain.birdHit ? BIRD_BONUS : 0;
  const groundBonus = chain.groundBounce ? GROUND_BONUS : 0;
  const subtotal = BASKET_POINTS + objectPoints + birdBonus + groundBonus;
  const multiplier = Math.max(1, objects);
  return {
    objects,
    base: BASKET_POINTS,
    objectPoints,
    birdBonus,
    groundBonus,
    subtotal,
    multiplier,
    total: subtotal * multiplier,
  };
}

/** What this shot is worth right now if it went in; 0 once it has missed. */
export function pendingPoints(log: ShotLog): number {
  return scoreChain(log).total;
}

/** Banked score for a finished shot. */
export function bankedPoints(log: ShotLog): number {
  return log.scored ? scoreChain(log).total : 0;
}

export function formatPoints(n: number): string {
  return n.toLocaleString("en-GB");
}

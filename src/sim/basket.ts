import type { Vec2 } from "./types.ts";

// Basket detection without a blocking collider.
//
// The rim is two solid tubes in the physics world. Scoring is decided here by
// following the ball centre's path each tick as a line segment, so a fast
// ball that crosses the scoring region between two ticks is still caught.
//
//  - A basket needs the ball to cross the rim plane downwards between the
//    tubes ("entering"), then to drop fully below the tubes.
//  - Crossing the rim plane upwards between the tubes without having entered
//    from above (a ball coming up through the net) locks the hoop until the
//    ball has moved clear of it sideways, so it cannot drop back in and count.
//  - Balls that come in through the side of the net never cross the rim plane
//    between the tubes, so they never count.
//  - Once scored, the tracker ignores everything else, so a shot scores once.

export interface BasketGeometry {
  /** Rim centre. */
  cx: number;
  rimY: number;
  /** Rim centre to tube centre. */
  rimHalf: number;
  tubeR: number;
  ballR: number;
}

export type BasketPhase = "outside" | "entering";

export interface BasketTracker {
  phase: BasketPhase;
  upwardLock: boolean;
  scored: boolean;
}

export type BasketStep = "entered" | "popped-out" | "upward" | "scored" | null;

export function newBasketTracker(): BasketTracker {
  return { phase: "outside", upwardLock: false, scored: false };
}

function crossX(a: Vec2, b: Vec2, y: number): number {
  const t = (y - a.y) / (b.y - a.y);
  return a.x + (b.x - a.x) * t;
}

/** Advance the tracker along the ball centre's path from prev to curr. */
export function basketStep(t: BasketTracker, g: BasketGeometry, prev: Vec2, curr: Vec2): BasketStep {
  if (t.scored) return null;
  const left = g.cx - g.rimHalf;
  const right = g.cx + g.rimHalf;
  const clear = g.rimHalf + g.tubeR + g.ballR;
  let result: BasketStep = null;

  if (t.upwardLock && Math.abs(curr.x - g.cx) > clear) t.upwardLock = false;

  if (prev.y > g.rimY && curr.y <= g.rimY) {
    const x = crossX(prev, curr, g.rimY);
    if (x > left && x < right && !t.upwardLock) {
      t.phase = "entering";
      result = "entered";
    }
  } else if (prev.y <= g.rimY && curr.y > g.rimY) {
    const x = crossX(prev, curr, g.rimY);
    if (x > left && x < right) {
      if (t.phase === "entering") {
        t.phase = "outside";
        result = "popped-out";
      } else {
        t.upwardLock = true;
        result = "upward";
      }
    }
  }

  if (t.phase === "entering") {
    const bottom = g.rimY - g.tubeR - g.ballR - 0.02;
    if (prev.y > bottom && curr.y <= bottom) {
      const x = crossX(prev, curr, bottom);
      if (Math.abs(x - g.cx) < clear) {
        t.scored = true;
        return "scored";
      }
      t.phase = "outside";
    }
  }
  return result;
}

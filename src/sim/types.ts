export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Aim in whole tenths: angleTenths 623 is 62.3 degrees (0 points right,
 * 900 straight up) and powerTenths 785 is 78.5% power.
 */
export interface Aim {
  angleTenths: number;
  powerTenths: number;
}

/** What the ball touched. Every collider in a shot world carries one. */
export interface ColliderTag {
  /** Identity for scoring: two bins have two ids and both count. */
  objectId: string;
  /** Behaviour family: roof, bin, trampoline, umbrella, bird, backboard, rim, ground, wall, pole. */
  kind: string;
  /** Sub-part, such as "mat" or "frame" on a trampoline. */
  part: string;
  /** Eligible objects count towards the chain and the multiplier. */
  eligible: boolean;
}

export interface ImpactEvent {
  type: "impact";
  tick: number;
  objectId: string;
  kind: string;
  part: string;
  eligible: boolean;
  /** Where the ball met the surface. */
  point: Vec2;
  /** Surface normal, pointing out towards the ball. */
  normal: Vec2;
  /** Speed into the surface, for sound and reaction strength. */
  speed: number;
}

export type EndReason = "settled" | "out" | "timeout" | "rolled";

export type SimEvent =
  | ImpactEvent
  | { type: "basket"; tick: number; swish: boolean; point: Vec2 }
  | { type: "boost"; tick: number; objectId: string; speed: number; point: Vec2 }
  | { type: "fold"; tick: number; objectId: string }
  | { type: "bird-hit"; tick: number; objectId: string; point: Vec2 }
  | { type: "end"; tick: number; reason: EndReason };

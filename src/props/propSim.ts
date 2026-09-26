import type { Collider, ColliderDesc, RigidBody, World } from "@dimforge/rapier2d-deterministic-compat";
import type { Rapier } from "../sim/rapier.ts";
import type { ColliderTag, SimEvent, Vec2 } from "../sim/types.ts";
import type { PropDef } from "./defs.ts";

/** Handed to each prop while a shot world is being built. */
export interface BuildContext {
  R: Rapier;
  world: World;
  /** True for the trajectory preview world, which only holds props that never move. */
  staticOnly: boolean;
  /** Phase tick (see BirdPath) of the moment the shot starts. */
  startPhase: number;
  addCollider(desc: ColliderDesc, tag: ColliderTag, body?: RigidBody): Collider;
}

/** Passed to a prop when the ball starts touching it. */
export interface ImpactContext {
  tick: number;
  part: string;
  ballPos: Vec2;
  /** Ball velocity before the step in which the contact happened. */
  velBefore: Vec2;
  /** Surface normal pointing towards the ball. */
  normal: Vec2;
  setBallVelocity(v: Vec2): void;
  emit(e: SimEvent): void;
}

/** The simulation side of a prop instance inside one shot world. */
export interface PropSim {
  readonly def: PropDef;
  /** Called before every physics step with the phase tick the step ends on. */
  beforeStep?(phaseTick: number): void;
  onImpact?(ctx: ImpactContext): void;
  afterStep?(tick: number, emit: (e: SimEvent) => void): void;
  /** Small, render-friendly state such as { folded: true }. */
  state?(): Record<string, number | boolean>;
}

export interface MovingObstacle {
  objectId: string;
  radius: number;
  position(phaseTick: number): Vec2;
}

export interface PropSimFactory<D extends PropDef = PropDef> {
  build(def: D, ctx: BuildContext): PropSim;
  /** Props that move provide this so the preview can account for them. */
  moving?(def: D): MovingObstacle;
}

/** Surface materials. The ball itself has zero restitution/friction and uses
 * the Max combine rule, so these numbers are exactly what each bounce gets. */
export interface SurfaceMaterial {
  restitution: number;
  friction: number;
}

export function applyMaterial(desc: ColliderDesc, m: SurfaceMaterial): ColliderDesc {
  return desc.setRestitution(m.restitution).setFriction(m.friction);
}

export function flatPoints(points: Vec2[]): Float32Array {
  const out = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    out[i * 2] = p.x;
    out[i * 2 + 1] = p.y;
  });
  return out;
}

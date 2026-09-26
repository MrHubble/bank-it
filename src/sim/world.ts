import type { Collider, ColliderDesc, RigidBody, World } from "@dimforge/rapier2d-deterministic-compat";
import type { LayoutDef } from "../props/defs.ts";
import { applyMaterial, type BuildContext, type MovingObstacle, type PropSim } from "../props/propSim.ts";
import { propSimFor } from "../props/registry.ts";
import { BALL_RADIUS, DT, GRAVITY } from "./constants.ts";
import type { Rapier } from "./rapier.ts";
import type { ColliderTag, Vec2 } from "./types.ts";

export const GROUND_MATERIAL = { restitution: 0.7, friction: 0.5 };

export interface BuiltWorld {
  world: World;
  tags: Map<number, ColliderTag>;
  colliders: Map<number, Collider>;
  props: PropSim[];
}

/**
 * Build a fresh physics world for a layout. Every shot gets a new world built
 * in the same order, so identical aim and release timing always replay
 * identically, whatever happened on earlier attempts.
 */
export function buildWorld(R: Rapier, layout: LayoutDef, opts: { staticOnly: boolean; startPhase: number }): BuiltWorld {
  const world = new R.World({ x: 0, y: GRAVITY });
  world.timestep = DT;
  const tags = new Map<number, ColliderTag>();
  const colliders = new Map<number, Collider>();
  const addCollider = (desc: ColliderDesc, tag: ColliderTag, body?: RigidBody): Collider => {
    const c = world.createCollider(desc, body);
    tags.set(c.handle, tag);
    colliders.set(c.handle, c);
    return c;
  };
  addCollider(applyMaterial(R.ColliderDesc.cuboid(40, 1).setTranslation(8, -1), GROUND_MATERIAL), {
    objectId: "ground",
    kind: "ground",
    part: "driveway",
    eligible: false,
  });
  const ctx: BuildContext = { R, world, staticOnly: opts.staticOnly, startPhase: opts.startPhase, addCollider };
  const props = layout.props.map((def) => propSimFor(def).build(def, ctx));
  return { world, tags, colliders, props };
}

export function createBall(R: Rapier, world: World, pos: Vec2, vel: Vec2): { body: RigidBody; collider: Collider } {
  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y)
      .setLinvel(vel.x, vel.y)
      .setCcdEnabled(true)
      .setCanSleep(false)
      .setAngularDamping(0.15),
  );
  const collider = world.createCollider(
    R.ColliderDesc.ball(BALL_RADIUS)
      .setDensity(1)
      .setRestitution(0)
      .setFriction(0)
      .setRestitutionCombineRule(R.CoefficientCombineRule.Max)
      .setFrictionCombineRule(R.CoefficientCombineRule.Max)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  return { body, collider };
}

export function movingObstacles(layout: LayoutDef): MovingObstacle[] {
  const out: MovingObstacle[] = [];
  for (const def of layout.props) {
    const f = propSimFor(def);
    if (f.moving) out.push(f.moving(def));
  }
  return out;
}

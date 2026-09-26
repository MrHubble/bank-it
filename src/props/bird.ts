import { DT } from "../sim/constants.ts";
import { PI, dsin } from "../sim/dmath.ts";
import type { Vec2 } from "../sim/types.ts";
import type { BirdDef, BirdPath } from "./defs.ts";
import type { PropSimFactory } from "./propSim.ts";

/** Seagull patrol: there and back along a readable lane, easing at each turn. */
export function birdPosition(path: BirdPath, phaseTick: number): Vec2 {
  const P = path.period;
  let t = (phaseTick + Math.round(path.start * P)) % P;
  if (t < 0) t += P;
  const u = t / P;
  const w = u < 0.5 ? u * 2 : (1 - u) * 2;
  const e = w * w * (3 - 2 * w);
  return {
    x: path.x0 + (path.x1 - path.x0) * e,
    y: path.y + path.bob * dsin(u * 4 * PI),
  };
}

export function birdVelocity(path: BirdPath, phaseTick: number): Vec2 {
  const a = birdPosition(path, phaseTick - 1);
  const b = birdPosition(path, phaseTick);
  return { x: (b.x - a.x) / DT, y: (b.y - a.y) / DT };
}

/** Bumper response: reflect off the bird, keep most of the speed, add a kick. */
export const BIRD_BOUNCE = { restitution: 0.88, kick: 2.6, maxSpeed: 16.5 };

export function birdRebound(velBefore: Vec2, birdVel: Vec2, normal: Vec2): Vec2 {
  const rx = velBefore.x - birdVel.x;
  const ry = velBefore.y - birdVel.y;
  const vn = rx * normal.x + ry * normal.y;
  let ox = rx;
  let oy = ry;
  if (vn < 0) {
    ox = rx - 2 * vn * normal.x;
    oy = ry - 2 * vn * normal.y;
  }
  let vx = ox * BIRD_BOUNCE.restitution + birdVel.x + normal.x * BIRD_BOUNCE.kick;
  let vy = oy * BIRD_BOUNCE.restitution + birdVel.y + normal.y * BIRD_BOUNCE.kick;
  const sp = Math.sqrt(vx * vx + vy * vy);
  if (sp > BIRD_BOUNCE.maxSpeed) {
    vx = (vx / sp) * BIRD_BOUNCE.maxSpeed;
    vy = (vy / sp) * BIRD_BOUNCE.maxSpeed;
  }
  return { x: vx, y: vy };
}

/**
 * A kinematic body that follows its patrol. The first time the ball touches
 * it, the ball gets a predictable bumper rebound and the bird's collider is
 * switched off, so there is only ever one bird deflection per shot. The
 * squawk, feathers and tumble are all cosmetic.
 */
export const birdSim: PropSimFactory<BirdDef> = {
  moving: (def) => ({
    objectId: def.id,
    radius: def.radius,
    position: (phase) => birdPosition(def.path, phase),
  }),
  build(def, { R, world, staticOnly, startPhase, addCollider }) {
    if (staticOnly) return { def };
    const p0 = birdPosition(def.path, startPhase);
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p0.x, p0.y));
    const collider = addCollider(
      R.ColliderDesc.ball(def.radius).setRestitution(0.8).setFriction(0),
      { objectId: def.id, kind: "bird", part: "body", eligible: true },
      body,
    );
    let hit = false;
    let hitTick = -1;
    return {
      def,
      beforeStep(phaseTick) {
        if (!hit) body.setNextKinematicTranslation(birdPosition(def.path, phaseTick));
      },
      onImpact(ctx) {
        if (hit) return;
        hit = true;
        hitTick = ctx.tick;
        const bp = body.translation();
        let nx = ctx.ballPos.x - bp.x;
        let ny = ctx.ballPos.y - bp.y;
        const len = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= len;
        ny /= len;
        const bv = birdVelocity(def.path, startPhase + ctx.tick);
        ctx.setBallVelocity(birdRebound(ctx.velBefore, bv, { x: nx, y: ny }));
        collider.setEnabled(false);
        ctx.emit({ type: "bird-hit", tick: ctx.tick, objectId: def.id, point: { x: bp.x, y: bp.y } });
      },
      state: () => ({ hit, hitTick }),
    };
  },
};

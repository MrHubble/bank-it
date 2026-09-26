import type { LayoutDef } from "../props/defs.ts";
import type { MovingObstacle } from "../props/propSim.ts";
import { BALL_RADIUS, PREVIEW_MAX_LENGTH, PREVIEW_MAX_TICKS } from "./constants.ts";
import { launchVelocity } from "./launch.ts";
import type { Rapier } from "./rapier.ts";
import type { Aim, Vec2 } from "./types.ts";
import { buildWorld, createBall, movingObstacles } from "./world.ts";

export interface PreviewHit {
  point: Vec2;
  objectId: string;
  kind: string;
}

export interface Preview {
  /** Ball centre positions from launch, one per tick. */
  points: Vec2[];
  /** First predicted contact, if the short preview reaches one. */
  hit: PreviewHit | null;
}

/**
 * The dotted aiming preview. It runs the real launch through a real physics
 * world (same gravity, timestep, solver and ball) holding only the props that
 * never move, and stops at the first contact or after a short distance. The
 * seagull is then checked against the same points at the times the ball would
 * reach them, so the preview never promises a clear path through a moving bird.
 */
export class PreviewProbe {
  private readonly R: Rapier;
  private readonly layout: LayoutDef;
  private readonly moving: MovingObstacle[];
  private cacheKey = "";
  private cache: Preview = { points: [], hit: null };

  constructor(R: Rapier, layout: LayoutDef) {
    this.R = R;
    this.layout = layout;
    this.moving = movingObstacles(layout);
  }

  get hasMovingObstacles(): boolean {
    return this.moving.length > 0;
  }

  /** Static part of the preview; cached until the aim changes. */
  predictStatic(aim: Aim): Preview {
    const key = `${aim.angleTenths}/${aim.powerTenths}`;
    if (key === this.cacheKey) return this.cache;
    const built = buildWorld(this.R, this.layout, { staticOnly: true, startPhase: 0 });
    const { world, tags, colliders } = built;
    const queue = new this.R.EventQueue(true);
    try {
      const ball = createBall(this.R, world, this.layout.launch, launchVelocity(aim));
      const points: Vec2[] = [{ ...this.layout.launch }];
      let hit: PreviewHit | null = null;
      let length = 0;
      for (let k = 0; k < PREVIEW_MAX_TICKS && !hit && length < PREVIEW_MAX_LENGTH; k++) {
        world.step(queue);
        queue.drainCollisionEvents((h1, h2, started) => {
          if (!started || hit) return;
          const other = h1 === ball.collider.handle ? h2 : h2 === ball.collider.handle ? h1 : null;
          const tag = other === null ? undefined : tags.get(other);
          if (!tag || other === null) return;
          const t = ball.body.translation();
          const proj = colliders.get(other)?.projectPoint({ x: t.x, y: t.y }, true);
          hit = { point: proj ? { x: proj.point.x, y: proj.point.y } : { x: t.x, y: t.y }, objectId: tag.objectId, kind: tag.kind };
        });
        if (hit) break;
        const t = ball.body.translation();
        const last = points[points.length - 1];
        length += Math.hypot(t.x - last.x, t.y - last.y);
        points.push({ x: t.x, y: t.y });
      }
      this.cacheKey = key;
      this.cache = { points, hit };
      return this.cache;
    } finally {
      queue.free();
      world.free();
    }
  }

  /** Full preview for a release on this phase tick, including moving props. */
  predict(aim: Aim, phaseAtRelease: number): Preview {
    const base = this.predictStatic(aim);
    if (!this.moving.length) return base;
    for (let k = 1; k < base.points.length; k++) {
      const p = base.points[k];
      for (const m of this.moving) {
        const c = m.position(phaseAtRelease + k);
        const r = m.radius + BALL_RADIUS;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        if (dx * dx + dy * dy <= r * r) {
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          return {
            points: base.points.slice(0, k),
            hit: { point: { x: c.x + (dx / d) * m.radius, y: c.y + (dy / d) * m.radius }, objectId: m.objectId, kind: "bird" },
          };
        }
      }
    }
    return base;
  }
}

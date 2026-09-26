import { clamp } from "../sim/dmath.ts";
import type { TrampolineDef } from "./defs.ts";
import { TRAMPOLINE_FRAME_RADIUS, TRAMPOLINE_MAT_THICKNESS, trampolineGeometry } from "./geometry.ts";
import { applyMaterial, type PropSimFactory } from "./propSim.ts";

/**
 * The mat throws the ball up at a speed that depends only gently on how hard
 * it lands, so the bounce height is predictable enough to plan a chain around.
 * Horizontal speed is mostly kept. Each extra bounce in the same shot is
 * weaker, so a ball cannot bounce on the mat forever.
 */
export const TRAMPOLINE_BOOST = {
  gain: 0.5,
  base: 8.6,
  min: 10.5,
  max: 15,
  keepX: 0.9,
  fatigue: [1, 0.7, 0.45, 0.3],
};

export function trampolineLaunchSpeed(incomingVy: number, bounceIndex: number): number {
  const b = TRAMPOLINE_BOOST;
  const f = b.fatigue[Math.min(bounceIndex, b.fatigue.length - 1)];
  return clamp(b.gain * Math.abs(incomingVy) + b.base, b.min, b.max) * f;
}

export const FRAME_MATERIAL = { restitution: 0.5, friction: 0.3 };
const MAT_MATERIAL = { restitution: 0, friction: 0 };

export const trampolineSim: PropSimFactory<TrampolineDef> = {
  build(def, { R, addCollider }) {
    const g = trampolineGeometry(def);
    addCollider(
      applyMaterial(
        R.ColliderDesc.cuboid(g.matHalfWidth, TRAMPOLINE_MAT_THICKNESS / 2).setTranslation(
          def.x,
          g.matTop - TRAMPOLINE_MAT_THICKNESS / 2,
        ),
        MAT_MATERIAL,
      ),
      { objectId: def.id, kind: "trampoline", part: "mat", eligible: true },
    );
    for (const p of [g.leftFrame, g.rightFrame]) {
      addCollider(applyMaterial(R.ColliderDesc.ball(TRAMPOLINE_FRAME_RADIUS).setTranslation(p.x, p.y), FRAME_MATERIAL), {
        objectId: def.id,
        kind: "trampoline",
        part: "frame",
        eligible: true,
      });
    }
    let bounces = 0;
    return {
      def,
      onImpact(ctx) {
        if (ctx.part !== "mat" || ctx.normal.y < 0.5 || ctx.velBefore.y > -0.5) return;
        const vy = trampolineLaunchSpeed(ctx.velBefore.y, bounces);
        bounces += 1;
        ctx.setBallVelocity({ x: ctx.velBefore.x * TRAMPOLINE_BOOST.keepX, y: vy });
        ctx.emit({ type: "boost", tick: ctx.tick, objectId: def.id, speed: vy, point: ctx.ballPos });
      },
      state: () => ({ bounces }),
    };
  },
};

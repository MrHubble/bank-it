import type { Collider } from "@dimforge/rapier2d-deterministic-compat";
import type { UmbrellaDef } from "./defs.ts";
import { UMBRELLA_POLE_RADIUS, umbrellaCanopy } from "./geometry.ts";
import { applyMaterial, flatPoints, type PropSimFactory } from "./propSim.ts";

export const CANOPY_MATERIAL = { restitution: 0.78, friction: 0.15 };
export const POLE_MATERIAL = { restitution: 0.45, friction: 0.3 };

/** Ticks between the first canopy hit and the umbrella folding shut. */
export const FOLD_DELAY = 9;

/**
 * The canopy bounces the ball once, then the umbrella folds shut. A folded
 * umbrella is inactive: its canopy collider is switched off (and the model
 * shows it closed and faded) until the next attempt resets it.
 */
export const umbrellaSim: PropSimFactory<UmbrellaDef> = {
  build(def, { R, addCollider }) {
    const canopyDesc = R.ColliderDesc.convexHull(flatPoints(umbrellaCanopy(def)));
    if (!canopyDesc) throw new Error(`Bad canopy for ${def.id}`);
    const canopy: Collider = addCollider(applyMaterial(canopyDesc, CANOPY_MATERIAL), {
      objectId: def.id,
      kind: "umbrella",
      part: "canopy",
      eligible: true,
    });
    const poleTop = def.poleHeight - 0.1;
    addCollider(
      applyMaterial(
        R.ColliderDesc.cuboid(UMBRELLA_POLE_RADIUS, poleTop / 2).setTranslation(def.x, poleTop / 2),
        POLE_MATERIAL,
      ),
      { objectId: `${def.id}-pole`, kind: "pole", part: "pole", eligible: false },
    );
    let foldAt = -1;
    let folded = false;
    return {
      def,
      onImpact(ctx) {
        if (ctx.part === "canopy" && foldAt < 0) foldAt = ctx.tick + FOLD_DELAY;
      },
      afterStep(tick, emit) {
        if (!folded && foldAt >= 0 && tick >= foldAt) {
          folded = true;
          canopy.setEnabled(false);
          emit({ type: "fold", tick, objectId: def.id });
        }
      },
      state: () => ({ folded }),
    };
  },
};

import type { GarageDef } from "./defs.ts";
import { applyMaterial, type PropSimFactory } from "./propSim.ts";

export const WALL_MATERIAL = { restitution: 0.6, friction: 0.35 };

/** The garage front wall and roller door. Solid, but not a trick-shot object. */
export const garageSim: PropSimFactory<GarageDef> = {
  build(def, { R, addCollider }) {
    const hx = (def.x1 - def.x0) / 2;
    const hy = def.wallTop / 2;
    addCollider(applyMaterial(R.ColliderDesc.cuboid(hx, hy).setTranslation(def.x0 + hx, hy), WALL_MATERIAL), {
      objectId: def.id,
      kind: "wall",
      part: "wall",
      eligible: false,
    });
    return { def };
  },
};

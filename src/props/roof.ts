import type { RoofDef } from "./defs.ts";
import { roofOutline } from "./geometry.ts";
import { applyMaterial, flatPoints, type PropSimFactory } from "./propSim.ts";

export const ROOF_MATERIAL = { restitution: 0.62, friction: 0.3 };

/** A sloped tile roof. The collider is a fixed slab; tile rattles are cosmetic. */
export const roofSim: PropSimFactory<RoofDef> = {
  build(def, { R, addCollider }) {
    const desc = R.ColliderDesc.convexHull(flatPoints(roofOutline(def)));
    if (!desc) throw new Error(`Bad roof outline for ${def.id}`);
    addCollider(applyMaterial(desc, ROOF_MATERIAL), { objectId: def.id, kind: "roof", part: "tiles", eligible: true });
    return { def };
  },
};

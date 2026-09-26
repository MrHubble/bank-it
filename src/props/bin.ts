import type { BinDef } from "./defs.ts";
import { binGeometry } from "./geometry.ts";
import { applyMaterial, flatPoints, type PropSimFactory } from "./propSim.ts";

export const BIN_BODY_MATERIAL = { restitution: 0.7, friction: 0.25 };
export const BIN_LID_MATERIAL = { restitution: 0.82, friction: 0.2 };

/** A wheelie bin with its lid propped up at an angle. The wobble is cosmetic;
 * the collision shape stays put so bank shots are repeatable. */
export const binSim: PropSimFactory<BinDef> = {
  build(def, { R, addCollider }) {
    const g = binGeometry(def);
    const body = R.ColliderDesc.convexHull(flatPoints(g.body));
    const lid = R.ColliderDesc.convexHull(flatPoints(g.lid));
    if (!body || !lid) throw new Error(`Bad bin outline for ${def.id}`);
    addCollider(applyMaterial(body, BIN_BODY_MATERIAL), { objectId: def.id, kind: "bin", part: "body", eligible: true });
    addCollider(applyMaterial(lid, BIN_LID_MATERIAL), { objectId: def.id, kind: "bin", part: "lid", eligible: true });
    return { def };
  },
};

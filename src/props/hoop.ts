import type { HoopDef } from "./defs.ts";
import { hoopGeometry } from "./geometry.ts";
import { applyMaterial, type PropSimFactory } from "./propSim.ts";

export const RIM_MATERIAL = { restitution: 0.55, friction: 0.15 };
export const BOARD_MATERIAL = { restitution: 0.72, friction: 0.15 };

/** Two rim tubes with a real opening between them, plus the backboard. */
export const hoopSim: PropSimFactory<HoopDef> = {
  build(def, { R, addCollider }) {
    const g = hoopGeometry(def);
    for (const [part, tube] of [
      ["front", g.leftTube],
      ["back", g.rightTube],
    ] as const) {
      addCollider(
        applyMaterial(R.ColliderDesc.ball(def.tubeR).setTranslation(tube.x, tube.y), RIM_MATERIAL),
        { objectId: "rim", kind: "rim", part, eligible: false },
      );
    }
    const b = g.board;
    addCollider(
      applyMaterial(
        R.ColliderDesc.cuboid((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2).setTranslation((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2),
        BOARD_MATERIAL,
      ),
      { objectId: def.id, kind: "backboard", part: "board", eligible: true },
    );
    return { def };
  },
};

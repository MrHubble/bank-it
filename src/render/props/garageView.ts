import * as THREE from "three";
import type { GarageDef, RoofDef } from "../../props/defs.ts";
import { extrudeOutline, mergedMesh, part, toon } from "../materials.ts";
import { roofView } from "./roofView.ts";
import type { PropView, PropViewFactory } from "./types.ts";

export const GARAGE_Z_BACK = -4.7;
/** The garage (and its roof edge) stops just in front of the play plane, so
 * the roof's front edge sits right next to the line the ball actually rolls on. */
export const GARAGE_Z_FRONT = 0.6;

function roofUndersideAt(r: RoofDef | undefined, x: number, fallback: number): number {
  if (!r) return fallback;
  const t = (x - r.eave.x) / (r.ridge.x - r.eave.x);
  return r.eave.y - r.thickness + (r.ridge.y - r.eave.y) * t;
}

/** Garage with a roller door under the hoop. Solid, but not a trick-shot object. */
export const garageView: PropViewFactory<GarageDef> = {
  create(def, layout) {
    const roof = layout.props.find((p): p is RoofDef => p.type === "roof" && p.eave.x < def.x0 + 1);
    const root = new THREE.Group();
    root.name = "garage";
    const depth = GARAGE_Z_FRONT - GARAGE_Z_BACK;
    const zMid = (GARAGE_Z_FRONT + GARAGE_Z_BACK) / 2;
    // Draw the whole gable building so it never looks cut off on wide
    // screens. Beyond the ridge the ball is already out of play, so the far
    // roof slope is scenery only (no collider).
    const farWall = roof ? 2 * roof.ridge.x - def.x0 : def.x1;
    const outline = roof
      ? [
          { x: def.x0, y: 0 },
          { x: farWall, y: 0 },
          { x: farWall, y: roofUndersideAt(roof, def.x0, def.wallTop) + 0.05 },
          { x: roof.ridge.x, y: roof.ridge.y - roof.thickness + 0.05 },
          { x: def.x0, y: roofUndersideAt(roof, def.x0, def.wallTop) + 0.05 },
        ]
      : [
          { x: def.x0, y: 0 },
          { x: def.x1, y: 0 },
          { x: def.x1, y: def.wallTop },
          { x: def.x0, y: def.wallTop },
        ];
    const body = part(extrudeOutline(outline, depth, 0.02), toon("#f3e4c4"), { outline: 0.03 });
    body.position.z = zMid;
    root.add(body);

    // Weatherboards on the camera-facing side (one merged mesh).
    const boardGeo = new THREE.BoxGeometry(farWall - def.x0 - 0.1, 0.03, 0.02);
    const boards: { geometry: THREE.BufferGeometry; position: THREE.Vector3Like }[] = [];
    for (let y = 0.35; y < def.wallTop; y += 0.35) boards.push({ geometry: boardGeo, position: { x: (def.x0 + farWall) / 2, y, z: GARAGE_Z_FRONT + 0.01 } });
    root.add(mergedMesh(boards, toon("#e6d2ab"), { outline: false, cast: false }));
    boardGeo.dispose();
    // Side window.
    const win = part(new THREE.BoxGeometry(0.95, 0.85, 0.06), toon("#fbf8f0"), { outline: 0.02 });
    win.position.set(def.x0 + 1.25, 1.9, GARAGE_Z_FRONT + 0.02);
    root.add(win);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.68, 0.07), toon("#8fd3ff"));
    glass.position.copy(win.position);
    root.add(glass);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.08), toon("#fbf8f0"));
    bar.position.copy(win.position);
    root.add(bar);

    // Roller door on the front wall, under the hoop.
    const doorW = 2.9;
    const door = part(new THREE.BoxGeometry(0.05, 2.55, doorW), toon("#c9d3dc"), { outline: 0.02 });
    door.position.set(def.x0 - 0.02, 1.28, -1.75);
    root.add(door);
    const ribGeo = new THREE.BoxGeometry(0.06, 0.025, doorW - 0.05);
    const ribs: { geometry: THREE.BufferGeometry; position: THREE.Vector3Like }[] = [];
    for (let y = 0.2; y < 2.5; y += 0.22) ribs.push({ geometry: ribGeo, position: { x: def.x0 - 0.03, y, z: -1.75 } });
    root.add(mergedMesh(ribs, toon("#aab6c1"), { outline: false, cast: false }));
    ribGeo.dispose();
    if (roof) {
      const farRoof = roofView.create({ ...roof, id: `${roof.id}-far`, eave: { x: 2 * roof.ridge.x - roof.eave.x, y: roof.eave.y } }, layout);
      root.add(farRoof.object);
    }
    const view: PropView = { def, object: root };
    return view;
  },
};

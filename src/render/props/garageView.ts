import * as THREE from "three";
import type { GarageDef, RoofDef } from "../../props/defs.ts";
import { extrudeOutline, part, toon } from "../materials.ts";
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
    const outline = [
      { x: def.x0, y: 0 },
      { x: def.x1, y: 0 },
      { x: def.x1, y: roofUndersideAt(roof, def.x1, def.wallTop) + 0.05 },
      { x: def.x0, y: roofUndersideAt(roof, def.x0, def.wallTop) + 0.05 },
    ];
    const body = part(extrudeOutline(outline, depth, 0.02), toon("#f3e4c4"), { outline: 0.03 });
    body.position.z = zMid;
    root.add(body);

    // Weatherboards on the camera-facing side.
    const boardMat = toon("#e6d2ab");
    for (let y = 0.35; y < def.wallTop; y += 0.35) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(def.x1 - def.x0 - 0.1, 0.03, 0.02), boardMat);
      m.position.set((def.x0 + def.x1) / 2, y, GARAGE_Z_FRONT + 0.01);
      m.receiveShadow = true;
      root.add(m);
    }
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
    const ribMat = toon("#aab6c1");
    for (let y = 0.2; y < 2.5; y += 0.22) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, doorW - 0.05), ribMat);
      rib.position.set(def.x0 - 0.03, y, -1.75);
      root.add(rib);
    }
    const view: PropView = { def, object: root };
    return view;
  },
};

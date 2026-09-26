import * as THREE from "three";
import type { UmbrellaDef } from "../../props/defs.ts";
import { UMBRELLA_POLE_RADIUS } from "../../props/geometry.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { addOutline, part, toon, toonUnique } from "../materials.ts";
import { type PropView, type PropViewFactory, Spring, type ViewFrame } from "./types.ts";

const GORES = 8;
const PROFILE = 10;

/** Profile of the canopy from the tip (i = 0) to the rim, for fold amount k. */
function profile(u: UmbrellaDef, k: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= PROFILE; i++) {
    const s = i / PROFILE;
    // Open: the same dome as the collider. Closed: a narrow sleeve hanging down the pole.
    const openR = s * u.canopyRadius;
    const openY = 0.18 - (0.18 + u.canopyDrop) * s * s;
    const closedR = 0.02 + s * 0.13 + Math.sin(s * Math.PI) * 0.05;
    const closedY = 0.34 - s * (u.canopyRadius * 0.95);
    pts.push(new THREE.Vector2(openR + (closedR - openR) * k, openY + (closedY - openY) * k));
  }
  return pts;
}

/** Striped patio umbrella. One bounce, then it folds shut and stays inactive. */
export const umbrellaView: PropViewFactory<UmbrellaDef> = {
  create(def) {
    const root = new THREE.Group();
    root.name = def.id;
    root.position.set(def.x, 0, 0);
    const pole = part(new THREE.CylinderGeometry(UMBRELLA_POLE_RADIUS, UMBRELLA_POLE_RADIUS, def.poleHeight + 0.2, 8), toon("#f4efe6"), { outline: 0.015 });
    pole.position.y = (def.poleHeight + 0.2) / 2;
    root.add(pole);
    const base = part(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 16), toon("#3d4450"), { outline: 0.02 });
    base.position.y = 0.07;
    root.add(base);

    const hub = new THREE.Group();
    hub.position.y = def.poleHeight;
    hub.rotation.z = (-def.tilt * Math.PI) / 180;
    root.add(hub);

    const colors = def.colors.map((c) => new THREE.Color(c));
    const faded = colors.map((c) => c.clone().lerp(new THREE.Color("#9aa3ab"), 0.65));
    const mats = colors.map((c) => toonUnique(c, { side: THREE.DoubleSide }));
    const gores: THREE.Mesh[] = [];
    const build = (k: number) => {
      for (let i = 0; i < GORES; i++) {
        const geo = new THREE.LatheGeometry(profile(def, k), 1, (i / GORES) * Math.PI * 2, (Math.PI * 2) / GORES);
        if (gores[i]) {
          gores[i].geometry.dispose();
          gores[i].geometry = geo;
        } else {
          const m = new THREE.Mesh(geo, mats[i % 2]);
          m.castShadow = true;
          m.receiveShadow = true;
          gores.push(m);
          hub.add(m);
        }
      }
    };
    build(0);
    const finial = part(new THREE.SphereGeometry(0.06, 10, 8), toon("#f4efe6"), { outline: 0.012 });
    finial.position.y = 0.22;
    hub.add(finial);
    // Outline the whole canopy with one hull so it reads as a solid prop.
    const hullGeo = new THREE.LatheGeometry(profile(def, 0), 24);
    const hullHolder = new THREE.Mesh(hullGeo, new THREE.MeshBasicMaterial({ visible: false }));
    const hullOutline = addOutline(hullHolder, 0.03);
    hub.add(hullHolder);

    let fold = 0; // 0 open, 1 closed
    let folding = false;
    let foldT = 0;
    const bounce = new Spring(200, 8);

    const setFaded = (t: number) => {
      mats.forEach((m, i) => m.color.copy(colors[i % 2]).lerp(faded[i % 2], t));
    };

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: def.x, y: def.poleHeight + 0.8 }),
      onEvent(e: SimEvent, fx: Effects) {
        if (e.type === "impact" && e.objectId === def.id) {
          bounce.kick(-Math.min(4, 1 + e.speed * 0.3));
        } else if (e.type === "fold" && e.objectId === def.id) {
          folding = true;
          foldT = 0;
          hullOutline.visible = false;
          fx.burst("dust", { x: def.x, y: def.poleHeight }, { count: 6, speed: 1.4, colors: ["#ffffff", "#f1e6d4"], size: 0.1, life: 0.5, gravity: 0 });
        }
      },
      update(f: ViewFrame) {
        const b = bounce.step(f.dt);
        hub.scale.set(1 - b * 0.04, 1 + b * 0.08, 1 - b * 0.04);
        if (folding && fold < 1) {
          foldT += f.dt;
          // Quick snap shut with a comic overshoot.
          const t = Math.min(1, foldT / 0.28);
          fold = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
          build(Math.min(1, fold * 1.04));
          setFaded(fold);
          if (fold >= 1) hub.rotation.z = (-def.tilt * Math.PI) / 180 * 0.4 + 0.12;
        }
      },
      reset() {
        folding = false;
        fold = 0;
        build(0);
        setFaded(0);
        hullOutline.visible = true;
        hub.rotation.z = (-def.tilt * Math.PI) / 180;
        bounce.reset();
      },
    };
    return view;
  },
};

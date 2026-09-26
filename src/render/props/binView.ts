import * as THREE from "three";
import type { BinDef } from "../../props/defs.ts";
import { BIN_LID_OVERHANG, binGeometry } from "../../props/geometry.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { extrudeOutline, part, toon } from "../materials.ts";
import { type PropView, type PropViewFactory, Spring, type ViewFrame } from "./types.ts";

const DEPTH = 0.7;

/** Wheelie bin, lid propped open by an overflowing pizza box. Wobbles when hit. */
export const binView: PropViewFactory<BinDef> = {
  create(def) {
    const g = binGeometry(def);
    const root = new THREE.Group();
    root.name = def.id;
    // Pivot at the base so the wobble rocks the bin on its bottom edge.
    const rock = new THREE.Group();
    rock.position.set(def.x, 0, 0);
    root.add(rock);
    const local = (pts: { x: number; y: number }[]) => pts.map((p) => ({ x: p.x - def.x, y: p.y }));

    const body = part(extrudeOutline(local(g.body), DEPTH - 0.06, 0.03), toon(def.body), { outline: 0.03 });
    rock.add(body);
    // Moulded ribs on the side facing the camera.
    const ribMat = toon(new THREE.Color(def.body).multiplyScalar(0.82));
    for (const y of [0.3, 0.62]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.8, 0.05, 0.03), ribMat);
      rib.position.set(0, y * def.height, DEPTH / 2 - 0.02);
      rock.add(rib);
    }
    const hingeRight = def.lidRise === "left";
    const hingeX = (hingeRight ? 1 : -1) * (def.width / 2 + BIN_LID_OVERHANG);
    // Wheels on the hinge side.
    const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14);
    wheelGeo.rotateX(Math.PI / 2);
    for (const z of [-DEPTH / 2 + 0.02, DEPTH / 2 - 0.02]) {
      const w = part(wheelGeo, toon("#2c2c30"), { outline: 0.015 });
      w.position.set(hingeX * 0.72, 0.11, z);
      rock.add(w);
    }
    // Lid on its own hinge so it can flap.
    const lidPivot = new THREE.Group();
    lidPivot.position.set(hingeX, def.height, 0);
    rock.add(lidPivot);
    const lidPts = local(g.lid).map((p) => ({ x: p.x - hingeX, y: p.y - def.height }));
    const lid = part(extrudeOutline(lidPts, DEPTH + 0.04, 0.02), toon(def.lid), { outline: 0.03 });
    lidPivot.add(lid);
    const handle = part(new THREE.BoxGeometry(0.06, 0.06, DEPTH * 0.8), toon("#2c2c30"), { outline: 0.012 });
    handle.position.set((hingeRight ? 1 : -1) * 0.04, 0.02, 0);
    lidPivot.add(handle);
    // The pizza box that is keeping the lid open.
    const box = part(new THREE.BoxGeometry(0.46, 0.05, 0.42), toon("#d8ac6b"), { outline: 0.015 });
    const lowX = (hingeRight ? -1 : 1) * (def.width / 2 - 0.12);
    box.position.set(lowX, def.height + 0.05, 0.05);
    box.rotation.z = (hingeRight ? 1 : -1) * 0.35;
    rock.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.052, 0.06), toon("#c8402c"));
    stripe.position.copy(box.position);
    stripe.rotation.copy(box.rotation);
    rock.add(stripe);

    const wobble = new Spring(120, 4.2);
    const flap = new Spring(240, 6);

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: def.x, y: def.height + 0.9 }),
      onEvent(e: SimEvent, fx: Effects) {
        if (e.type !== "impact" || e.objectId !== def.id) return;
        const side = e.point.x < def.x ? 1 : -1;
        wobble.kick(side * Math.min(7, 1.5 + e.speed * 0.5));
        if (e.part === "lid") flap.kick(-(hingeRight ? 1 : -1) * Math.min(9, 2 + e.speed * 0.6));
        fx.burst("dust", { x: def.x, y: 0.05 }, { count: 4, speed: 0.8, dir: Math.PI / 2, spread: 2.4, colors: ["#e9dcc6"], size: 0.09, life: 0.5, gravity: 0.5 });
      },
      update(f: ViewFrame) {
        // Exaggerated, cartoon wobble. Purely cosmetic: the collider never moves.
        rock.rotation.z = wobble.step(f.dt) * 0.11;
        const fl = flap.step(f.dt);
        lidPivot.rotation.z = (hingeRight ? 1 : -1) * Math.max(-0.05, -fl) * 0.45;
      },
      reset() {
        wobble.reset();
        flap.reset();
        rock.rotation.z = 0;
        lidPivot.rotation.z = 0;
      },
    };
    return view;
  },
};

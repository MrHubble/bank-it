import * as THREE from "three";
import type { TrampolineDef } from "../../props/defs.ts";
import { TRAMPOLINE_FRAME_RADIUS } from "../../props/geometry.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { mergedMesh, part, toon, toonUnique } from "../materials.ts";
import { type PropView, type PropViewFactory, Spring, type ViewFrame } from "./types.ts";

/** Round backyard trampoline. The mat visibly sinks and springs on every boost. */
export const trampolineView: PropViewFactory<TrampolineDef> = {
  create(def) {
    const root = new THREE.Group();
    root.name = def.id;
    root.position.set(def.x, 0, 0);
    const R = def.width / 2;
    const top = def.height;
    // Padded frame ring.
    const pad = part(new THREE.TorusGeometry(R, TRAMPOLINE_FRAME_RADIUS, 10, 48), toon("#6ec3ff"), { outline: 0.025 });
    pad.rotation.x = Math.PI / 2;
    pad.position.y = top;
    root.add(pad);
    // Mat: a disc whose inner rings can dip.
    const rings = 7;
    const segs = 40;
    const matGeo = new THREE.CircleGeometry(R - TRAMPOLINE_FRAME_RADIUS * 0.6, segs, 0, Math.PI * 2);
    // Rebuild as a ringed disc so the dip is smooth.
    const ringGeo = new THREE.RingGeometry(0.001, R - TRAMPOLINE_FRAME_RADIUS * 0.6, segs, rings);
    matGeo.dispose();
    ringGeo.rotateX(-Math.PI / 2);
    const matPos = ringGeo.getAttribute("position") as THREE.BufferAttribute;
    const rest = Float32Array.from(matPos.array as Float32Array);
    const mat = new THREE.Mesh(ringGeo, toonUnique("#26262b", { side: THREE.DoubleSide }));
    mat.position.y = top - 0.02;
    mat.receiveShadow = true;
    root.add(mat);
    // Springs around the edge.
    const springGeo = new THREE.CylinderGeometry(0.012, 0.012, TRAMPOLINE_FRAME_RADIUS * 1.6, 5);
    springGeo.rotateZ(Math.PI / 2);
    const springs = new THREE.InstancedMesh(springGeo, toon("#b9c0c8"), 28);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      tmp.position.set(Math.cos(a) * (R - TRAMPOLINE_FRAME_RADIUS * 0.3), top - 0.01, Math.sin(a) * (R - TRAMPOLINE_FRAME_RADIUS * 0.3));
      tmp.rotation.set(0, -a, 0);
      tmp.updateMatrix();
      springs.setMatrixAt(i, tmp.matrix);
    }
    root.add(springs);
    // W-legs: pairs of uprights joined at the bottom, baked into one mesh.
    const upright = new THREE.CylinderGeometry(0.03, 0.03, top - 0.05, 6);
    const footGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
    const legs: { geometry: THREE.BufferGeometry; position: THREE.Vector3Like; rotation?: THREE.Euler }[] = [];
    for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
      const cx = Math.cos(a) * R * 0.95;
      const cz = Math.sin(a) * R * 0.95;
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      for (const s of [-1, 1]) legs.push({ geometry: upright, position: { x: cx + tangent.x * s * 0.22, y: (top - 0.05) / 2, z: cz + tangent.z * s * 0.22 } });
      legs.push({ geometry: footGeo, position: { x: cx, y: 0.03, z: cz }, rotation: new THREE.Euler(0, -a + Math.PI / 2, Math.PI / 2, "YXZ") });
    }
    root.add(mergedMesh(legs, toon("#3d4450"), { outline: 0.012 }));
    upright.dispose();
    footGeo.dispose();

    const dip = new Spring(220, 7);
    let dipX = 0;
    const setDip = (d: number) => {
      const arr = matPos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = rest[i];
        const z = rest[i + 2];
        const r = Math.hypot(x - dipX * 0.6, z) / R;
        arr[i + 1] = rest[i + 1] - d * Math.max(0, 1 - r * r);
      }
      matPos.needsUpdate = true;
      pad.position.y = top - d * 0.08;
    };

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: def.x, y: top + 0.9 }),
      onEvent(e: SimEvent, fx: Effects) {
        if (e.type === "boost" && e.objectId === def.id) {
          dipX = Math.max(-R * 0.7, Math.min(R * 0.7, e.point.x - def.x));
          dip.value = 0.26;
          dip.velocity = -1.5;
          fx.burst("dust", { x: e.point.x, y: top - 0.1 }, { count: 5, speed: 1.2, dir: -Math.PI / 2, spread: 2.2, colors: ["#e9dcc6"], size: 0.08, life: 0.45, gravity: 0.3 });
        } else if (e.type === "impact" && e.objectId === def.id && e.part === "frame") {
          dip.kick(0.8);
        }
      },
      update(f: ViewFrame) {
        setDip(dip.step(f.dt));
      },
      reset() {
        dip.reset();
        setDip(0);
      },
    };
    return view;
  },
};

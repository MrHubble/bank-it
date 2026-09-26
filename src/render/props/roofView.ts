import * as THREE from "three";
import type { RoofDef } from "../../props/defs.ts";
import { roofOutline } from "../../props/geometry.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { addOutline, extrudeOutline, part, toon } from "../materials.ts";
import { GARAGE_Z_BACK, GARAGE_Z_FRONT } from "./garageView.ts";
import type { PropView, PropViewFactory, ViewFrame } from "./types.ts";

const TILE_ALONG = 0.36;
const TILE_ACROSS = 0.44;

const dxOf = (r: RoofDef) => r.ridge.x - r.eave.x;

/** Terracotta roof. Tiles near the impact rattle; the slab collider never moves. */
export const roofView: PropViewFactory<RoofDef> = {
  create(def) {
    const root = new THREE.Group();
    root.name = def.id;
    const zBack = GARAGE_Z_BACK - 0.25;
    const zFront = GARAGE_Z_FRONT + 0.1;
    const depth = zFront - zBack;
    const slab = part(extrudeOutline(roofOutline(def), depth, 0.02), toon(def.color ?? "#9d3b2c"), { outline: 0.03 });
    slab.position.z = (zFront + zBack) / 2;
    root.add(slab);

    // Gutter along the eave.
    const gutter = part(new THREE.CylinderGeometry(0.09, 0.07, depth, 10, 1), toon("#e9e4dc"), { outline: 0.02 });
    gutter.rotation.x = Math.PI / 2;
    gutter.position.set(def.eave.x - 0.05 * Math.sign(dxOf(def)), def.eave.y - def.thickness * 0.55, (zFront + zBack) / 2);
    root.add(gutter);

    // Tiles: instanced, staggered courses up the slope.
    const dx = def.ridge.x - def.eave.x;
    const dy = def.ridge.y - def.eave.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy * Math.sign(dx);
    const ny = Math.abs(ux);
    const rows = Math.floor(len / TILE_ALONG);
    const cols = Math.floor(depth / TILE_ACROSS);
    const count = rows * cols;
    const tileGeo = new THREE.BoxGeometry(TILE_ALONG * 0.98, 0.07, TILE_ACROSS * 0.94);
    tileGeo.translate(0, 0.035, 0);
    const tiles = new THREE.InstancedMesh(tileGeo, toon("#d0603f"), count);
    tiles.castShadow = true;
    tiles.receiveShadow = true;
    const base: { s: number; z: number }[] = [];
    const tmp = new THREE.Object3D();
    const shade = [new THREE.Color("#d8694a"), new THREE.Color("#c95a3b"), new THREE.Color("#df7352")];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = (r + 0.5) * TILE_ALONG;
        const z = zBack + (c + 0.5 + (r % 2) * 0.5) * TILE_ACROSS;
        base.push({ s, z: Math.min(z, zFront - TILE_ACROSS / 2) });
        tiles.setColorAt(i, shade[(r * 7 + c * 3) % 3]);
        i++;
      }
    }
    const offsets = new Float32Array(count);
    const place = () => {
      for (let k = 0; k < count; k++) {
        const b = base[k];
        tmp.position.set(def.eave.x + ux * b.s + nx * offsets[k], def.eave.y + uy * b.s + ny * offsets[k], b.z);
        tmp.rotation.set(0, 0, Math.atan2(-nx, ny) + offsets[k] * 3);
        tmp.updateMatrix();
        tiles.setMatrixAt(k, tmp.matrix);
      }
      tiles.instanceMatrix.needsUpdate = true;
    };
    place();
    root.add(tiles);
    // Barge board: a bold trim along the front edge, right beside the play
    // plane, so the slope the ball actually rolls on is easy to read.
    const bargeLen = len + 0.1;
    const barge = part(new THREE.BoxGeometry(bargeLen, def.thickness + 0.08, 0.12), toon("#fbf3e4"), { outline: 0.03 });
    barge.position.set(def.eave.x + (ux * len) / 2, def.eave.y + (uy * len) / 2 - def.thickness / 2 + 0.02, zFront + 0.02);
    barge.rotation.z = Math.atan2(uy, ux);
    root.add(barge);
    // A ridge-cap line so the slope reads clearly against the sky.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, depth), toon("#7a2d22"));
    cap.position.set(def.ridge.x, def.ridge.y + 0.02, (zFront + zBack) / 2);
    addOutline(cap, 0.02);
    root.add(cap);

    let rattleT = 10;
    let rattleS = 0;
    let rattleAmp = 0;

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: def.eave.x + ux * len * 0.25, y: def.eave.y + uy * len * 0.25 + 0.5 }),
      onEvent(e: SimEvent, fx: Effects) {
        if (e.type !== "impact" || e.objectId !== def.id) return;
        rattleT = 0;
        rattleS = (e.point.x - def.eave.x) * ux + (e.point.y - def.eave.y) * uy;
        rattleAmp = Math.min(0.06, 0.012 + e.speed * 0.004);
        if (e.speed > 2) {
          fx.burst("chip", e.point, {
            count: Math.min(7, 2 + Math.round(e.speed / 3)),
            speed: 2 + e.speed * 0.2,
            dir: Math.atan2(e.normal.y, e.normal.x),
            spread: 1.6,
            colors: ["#d0603f", "#a8412c", "#e98a62"],
            size: 0.06,
            life: 0.6,
            gravity: -12,
          });
        }
      },
      update(f: ViewFrame) {
        if (rattleT > 0.8) return;
        rattleT += f.dt;
        if (rattleT > 0.8) {
          offsets.fill(0);
          place();
          return;
        }
        const decay = Math.exp(-rattleT * 7);
        for (let k = 0; k < count; k++) {
          const b = base[k];
          const ds = Math.abs(b.s - rattleS);
          if (ds > 1.4 || Math.abs(b.z) > 1.6) {
            offsets[k] = 0;
            continue;
          }
          const fall = (1 - ds / 1.4) * (1 - Math.abs(b.z) / 1.6);
          offsets[k] = rattleAmp * fall * decay * Math.abs(Math.sin(rattleT * 55 + k * 1.7));
        }
        place();
      },
      reset() {
        rattleT = 10;
        offsets.fill(0);
        place();
      },
    };
    return view;
  },
};

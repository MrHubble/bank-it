import * as THREE from "three";
import type { HoopDef } from "../../props/defs.ts";
import { hoopGeometry } from "../../props/geometry.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { part, toon } from "../materials.ts";
import { type PropView, type PropViewFactory, Spring, type ViewFrame } from "./types.ts";

const BOARD_WIDTH = 1.5;
const NET_DEPTH = 0.62;
const NET_STRANDS = 14;
const NET_ROWS = 5;

/** Oversized hoop on the garage: white board, orange rim, a net that swishes. */
export const hoopView: PropViewFactory<HoopDef> = {
  create(def) {
    const g = hoopGeometry(def);
    const root = new THREE.Group();
    root.name = "hoop";

    // Backboard: white slab with a red frame and shooter's square.
    const b = g.board;
    const boardGroup = new THREE.Group();
    boardGroup.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0);
    const h = b.y1 - b.y0;
    const board = part(new THREE.BoxGeometry(b.x1 - b.x0, h, BOARD_WIDTH), toon("#fbfbf7"), { outline: 0.03 });
    boardGroup.add(board);
    const red = toon("#e4432d");
    const faceX = -(b.x1 - b.x0) / 2 - 0.006;
    const strip = (y: number, z: number, hh: number, ww: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, hh, ww), red);
      m.position.set(faceX, y, z);
      boardGroup.add(m);
    };
    // Outer frame.
    strip(h / 2 - 0.05, 0, 0.07, BOARD_WIDTH - 0.04);
    strip(-h / 2 + 0.05, 0, 0.07, BOARD_WIDTH - 0.04);
    strip(0, BOARD_WIDTH / 2 - 0.05, h - 0.04, 0.07);
    strip(0, -BOARD_WIDTH / 2 + 0.05, h - 0.04, 0.07);
    // Shooter's square above the rim.
    const sqY = def.rimY - boardGroup.position.y + 0.3;
    strip(sqY + 0.22, 0, 0.05, 0.62);
    strip(sqY - 0.2, 0, 0.05, 0.62);
    strip(sqY, 0.3, 0.44, 0.05);
    strip(sqY, -0.3, 0.44, 0.05);
    root.add(boardGroup);

    // Rim: a torus lying flat, matching the two collision tubes at z = 0.
    const rimGroup = new THREE.Group();
    rimGroup.position.set(g.centre.x, def.rimY, 0);
    const rim = part(new THREE.TorusGeometry(def.rimHalf, def.tubeR, 10, 40), toon("#f0622d"), { outline: 0.018 });
    rim.rotation.x = Math.PI / 2;
    rimGroup.add(rim);
    const bracket = part(new THREE.BoxGeometry(def.gap + 0.02, 0.07, 0.24), toon("#3b3f46"), { outline: 0.015 });
    bracket.position.set(def.rimHalf + def.gap / 2, -0.03, 0);
    rimGroup.add(bracket);
    root.add(rimGroup);

    // Net: strands from the rim to a narrower bottom ring, criss-crossed.
    const netPositions: number[] = [];
    const rest: THREE.Vector3[] = [];
    const ringPoint = (row: number, i: number) => {
      const t = row / NET_ROWS;
      const r = def.rimHalf * (1 - 0.38 * t) - 0.01;
      const a = ((i + (row % 2) * 0.5) / NET_STRANDS) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, -t * NET_DEPTH, Math.sin(a) * r);
    };
    for (let row = 0; row < NET_ROWS; row++) {
      for (let i = 0; i < NET_STRANDS; i++) {
        const p = ringPoint(row, i);
        const q1 = ringPoint(row + 1, i);
        const q2 = ringPoint(row + 1, (i + NET_STRANDS - 1) % NET_STRANDS);
        for (const [a, c] of [
          [p, q1],
          [p, q2],
        ]) {
          rest.push(a.clone(), c.clone());
          netPositions.push(a.x, a.y, a.z, c.x, c.y, c.z);
        }
      }
    }
    const netGeo = new THREE.BufferGeometry();
    const netAttr = new THREE.Float32BufferAttribute(netPositions, 3);
    netGeo.setAttribute("position", netAttr);
    const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: "#ffffff" }));
    net.position.copy(rimGroup.position);
    net.frustumCulled = false;
    root.add(net);

    const rimWobble = new Spring(420, 10);
    const boardShake = new Spring(500, 14);
    let swish = 0; // seconds since last swish (large = idle)
    let swishDir = 0;
    let jiggle = 0;

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: g.centre.x, y: def.rimY + 0.6 }),
      onEvent(e: SimEvent, fx: Effects) {
        if (e.type === "impact" && e.kind === "rim") {
          rimWobble.kick(Math.min(4, e.speed * 0.5) * (e.part === "front" ? 1 : -1));
          jiggle = Math.min(1, e.speed * 0.12);
          fx.burst("spark", e.point, { count: 3, speed: 1.5, colors: ["#ffd23f", "#ffffff"], size: 0.06, life: 0.3, gravity: 0 });
        } else if (e.type === "impact" && e.kind === "backboard") {
          boardShake.kick(Math.min(3, e.speed * 0.3));
          jiggle = Math.max(jiggle, 0.4);
        } else if (e.type === "basket") {
          swish = 0;
          swishDir = e.swish ? 1 : 0.7;
        }
      },
      update(f: ViewFrame) {
        rimGroup.rotation.z = rimWobble.step(f.dt) * 0.035;
        boardGroup.position.x = (b.x0 + b.x1) / 2 + boardShake.step(f.dt) * 0.012;
        swish += f.dt;
        jiggle = Math.max(0, jiggle - f.dt * 1.6);
        const arr = netAttr.array as Float32Array;
        const sw = swish < 1.2 ? Math.exp(-swish * 3.2) * swishDir : 0;
        const idle = f.reducedMotion ? 0 : Math.sin(f.time * 1.3) * 0.006;
        for (let k = 0; k < rest.length; k++) {
          const r = rest[k];
          const depth = -r.y / NET_DEPTH; // 0 at rim, 1 at bottom
          // Swish: the net stretches down and flares as the ball drops through.
          const pull = sw * depth * (0.28 * Math.sin(Math.min(1, swish * 6) * Math.PI) + 0.1);
          const flare = 1 + sw * depth * 0.35 * Math.sin(swish * 18);
          const wig = jiggle * depth * 0.05 * Math.sin(f.time * 30 + k);
          arr[k * 3] = r.x * flare + wig + idle * depth;
          arr[k * 3 + 1] = r.y - pull;
          arr[k * 3 + 2] = r.z * flare;
        }
        netAttr.needsUpdate = true;
      },
      reset() {
        rimWobble.reset();
        boardShake.reset();
        swish = 10;
        jiggle = 0;
      },
    };
    return view;
  },
};

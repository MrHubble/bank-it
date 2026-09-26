import * as THREE from "three";
import type { DecorDef } from "../props/defs.ts";
import { OBLIQUE } from "./camera.ts";
import { toon, toonUnique } from "./materials.ts";
import { GARAGE_Z_BACK, GARAGE_Z_FRONT } from "./props/garageView.ts";

// The driveway set: sky, clouds, fence, lawn, footpath and kerb. None of it
// can be hit. It is kept unoutlined, a little softer in colour and behind the
// play plane (or flat on the ground), so props always read as the things that
// matter.

const FENCE_Z = GARAGE_Z_BACK - 0.2;
const KX = OBLIQUE.kx;
const KY = OBLIQUE.ky;

/** World position that appears at play-plane (x, y) on screen when placed at depth z. */
function atDepth(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x - KX * z, y + KY * z, z);
}

/** Warm concrete: faint speckle and a little tonal drift, tiled. */
function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(150,120,80,${0.03 + rnd() * 0.04})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 10 + rnd() * 40, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 1800; i++) {
    const d = rnd();
    g.fillStyle = d < 0.5 ? `rgba(90,70,50,${0.1 + rnd() * 0.12})` : `rgba(255,255,255,${0.2 + rnd() * 0.3})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

export function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#3fa9f0");
  grad.addColorStop(0.55, "#6ec3ff");
  grad.addColorStop(1, "#c8ebff");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, shadows = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y, z);
  m.receiveShadow = shadows;
  m.castShadow = shadows;
  return m;
}

function cloud(x: number, y: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const shade = new THREE.MeshBasicMaterial({ color: "#e3f3ff" });
  const puffs: [number, number, number][] = [
    [0, 0, 0.9],
    [0.9, -0.15, 0.7],
    [-0.9, -0.2, 0.65],
    [0.35, 0.45, 0.62],
    [-0.4, 0.3, 0.55],
  ];
  for (const [px, py, r] of puffs) {
    const under = new THREE.Mesh(new THREE.CircleGeometry(r, 20), shade);
    under.position.set(px + 0.05, py - 0.08, -0.01);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
    m.position.set(px, py, 0);
    g.add(under, m);
  }
  const flatBase = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), mat);
  flatBase.position.set(0, -0.35, 0.001);
  g.add(flatBase);
  g.scale.setScalar(s);
  g.position.copy(atDepth(x, y, -14));
  return g;
}

export class Scenery {
  readonly object = new THREE.Group();
  private readonly clouds: THREE.Group[] = [];
  private readonly decor = new THREE.Group();

  constructor() {
    const o = this.object;
    o.name = "scenery";
    // Ground: lawn everywhere, then the road, footpath and driveway on top.
    // Only as deep as the fence: the oblique camera would lift anything further back into the sky.
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(80, 12), toon("#8cc25e"));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(8, -0.002, FENCE_Z + 6 - 0.3);
    lawn.receiveShadow = true;
    o.add(lawn);
    const slab = (x0: number, x1: number, z0: number, z1: number, color: string, y = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), toon(color));
      m.position.set((x0 + x1) / 2, y - 0.03, (z0 + z1) / 2);
      m.receiveShadow = true;
      o.add(m);
      return m;
    };
    const drive = slab(1.35, 14.4, FENCE_Z, GARAGE_Z_FRONT + 0.1, "#e0d3bb", 0.004);
    drive.material = toonUnique("#e3d6be", { map: concreteTexture() });
    slab(-8, -0.25, FENCE_Z - 0.3, 8, "#6d6e74", -0.02);
    slab(-0.25, -0.05, FENCE_Z - 0.3, 8, "#cfd2d6", 0.02);
    slab(0.35, 1.35, FENCE_Z - 0.3, 8, "#ebe3d3", 0.002);
    // Driveway expansion joints and an oil stain.
    for (const x of [3.9, 6.5, 9.1, 11.7]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, GARAGE_Z_FRONT - FENCE_Z), toon("#c1b297"));
      j.position.set(x, 0.006, (GARAGE_Z_FRONT + FENCE_Z) / 2);
      o.add(j);
    }
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: "#cbbda4", transparent: true, opacity: 0.6 }));
    stain.rotation.x = -Math.PI / 2;
    stain.scale.set(1.6, 0.8, 1);
    stain.position.set(11.8, 0.007, -2.4);
    o.add(stain);

    // Timber fence along the back, stopping at the garage.
    const fence = new THREE.Group();
    const palingGeo = new THREE.BoxGeometry(0.16, 1.95, 0.05);
    const shades = ["#c48d5a", "#b8804e", "#cd9866"];
    const palings = new THREE.InstancedMesh(palingGeo, toon("#ffffff"), 140);
    let n = 0;
    const tmp = new THREE.Object3D();
    for (let x = -7; x < 14.3 && n < 140; x += 0.17) {
      tmp.position.set(x, 0.98 + ((n * 7) % 3) * 0.015, FENCE_Z);
      tmp.updateMatrix();
      palings.setMatrixAt(n, tmp.matrix);
      palings.setColorAt(n, new THREE.Color(shades[n % 3]));
      n++;
    }
    palings.count = n;
    palings.receiveShadow = true;
    fence.add(palings);
    for (const y of [0.35, 1.55]) fence.add(box(21.4, 0.1, 0.05, "#9d6c41", 3.65, y, FENCE_Z + 0.05, false));
    fence.add(box(21.4, 0.06, 0.1, "#a6734a", 3.65, 1.97, FENCE_Z, false));
    o.add(fence);

    // Garden bed along the fence.
    const bed = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.1, 0.8), toon("#8a6243"));
    bed.position.set(7.5, 0.04, FENCE_Z + 0.45);
    bed.receiveShadow = true;
    o.add(bed);
    const bushMat = [toon("#6fae54"), toon("#5f9f48"), toon("#7dbb5e")];
    const bushes: [number, number][] = [
      [1.9, 0.55],
      [3.1, 0.42],
      [5.7, 0.62],
      [7.2, 0.4],
      [10.2, 0.58],
      [12.6, 0.5],
    ];
    bushes.forEach(([x, r], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), bushMat[i % 3]);
      b.scale.set(1.2, 0.85, 0.8);
      b.position.set(x, r * 0.6, FENCE_Z + 0.5);
      b.castShadow = true;
      b.receiveShadow = true;
      o.add(b);
    });

    // Behind the fence: the neighbour's roof and a big tree.
    const far = new THREE.Group();
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-3.2, 0);
    roofShape.lineTo(3.2, 0);
    roofShape.lineTo(2.2, 1.6);
    roofShape.lineTo(-2.2, 1.6);
    roofShape.closePath();
    const nRoof = new THREE.Mesh(new THREE.ShapeGeometry(roofShape), new THREE.MeshBasicMaterial({ color: "#d9a79a" }));
    nRoof.position.copy(atDepth(4.6, 2.3, -9));
    const nWall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.2), new THREE.MeshBasicMaterial({ color: "#f3e7d3" }));
    nWall.position.copy(atDepth(4.6, 1.75, -9.1));
    far.add(nWall, nRoof);
    const trunk = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 1.6), new THREE.MeshBasicMaterial({ color: "#b89478" }));
    trunk.position.copy(atDepth(10.9, 2.3, -8));
    far.add(trunk);
    const canopyMat = new THREE.MeshBasicMaterial({ color: "#b3dc98" });
    const canopyShade = new THREE.MeshBasicMaterial({ color: "#a3d087" });
    for (const [dx, dy, r] of [
      [0, 3.4, 0.95],
      [-0.75, 3.0, 0.7],
      [0.8, 3.05, 0.72],
      [0.1, 3.95, 0.62],
    ] as [number, number, number][]) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(r, 24), canopyShade);
      sh.position.copy(atDepth(10.9 + dx + 0.1, dy - 0.1, -8.05));
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 24), canopyMat);
      c.position.copy(atDepth(10.9 + dx, dy, -8));
      far.add(sh, c);
    }
    o.add(far);

    for (const [x, y, s] of [
      [1.5, 7.3, 0.8],
      [7.2, 8.0, 1.05],
      [12.8, 7.1, 0.7],
      [17.5, 7.8, 0.9],
    ] as [number, number, number][]) {
      const c = cloud(x, y, s);
      this.clouds.push(c);
      o.add(c);
    }

    // Letterbox by the footpath, behind the play plane.
    const post = box(0.1, 1.0, 0.1, "#8a5a3b", 0.85, 0.5, -1.6);
    const mailbox = box(0.38, 0.3, 0.3, "#e4432d", 0.85, 1.12, -1.6);
    const flag = box(0.04, 0.2, 0.04, "#ffd23f", 1.05, 1.25, -1.45);
    o.add(post, mailbox, flag);
    o.add(this.decor);
  }

  /** Layout-specific decoration (a gnome, pot plants…). */
  setDecor(items: DecorDef[]): void {
    this.decor.clear();
    for (const d of items) {
      const g = new THREE.Group();
      const s = d.scale ?? 1;
      if (d.type === "gnome") {
        g.add(box(0.2, 0.26, 0.16, "#3b6fb6", 0, 0.13, 0));
        const beard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 10), toon("#fbfbf8"));
        beard.position.set(0.02, 0.28, 0.02);
        beard.rotation.z = Math.PI;
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon("#f1c08e"));
        face.position.set(0.03, 0.36, 0);
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 10), toon("#e4432d"));
        hat.position.set(0, 0.52, 0);
        g.add(beard, face, hat);
      } else if (d.type === "pot") {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), toon("#c8663f")));
        g.children[0].position.y = 0.15;
        const plant = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), toon(d.color ?? "#6fae54"));
        plant.position.y = 0.45;
        plant.scale.set(1, 1.2, 1);
        g.add(plant);
      } else if (d.type === "bike") {
        const wheelGeo = new THREE.TorusGeometry(0.3, 0.035, 6, 20);
        for (const x of [-0.45, 0.45]) {
          const w = new THREE.Mesh(wheelGeo, toon("#2c2c30"));
          w.position.set(x, 0.3, 0);
          g.add(w);
        }
        const frame = box(0.9, 0.05, 0.05, d.color ?? "#6ec3ff", 0, 0.52, 0, false);
        frame.rotation.z = 0.12;
        g.add(frame, box(0.05, 0.4, 0.05, d.color ?? "#6ec3ff", 0.1, 0.4, 0, false));
        g.rotation.z = -0.08;
      } else if (d.type === "hose") {
        const reel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 18), toon("#3fae5a"));
        reel.position.y = 0.3;
        g.add(reel, box(0.08, 0.3, 0.08, "#3d4450", 0, 0.15, 0));
      }
      g.traverse((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });
      g.scale.setScalar(s);
      if (d.flip) g.scale.x *= -1;
      g.position.set(d.x, 0, d.z ?? FENCE_Z + 0.5);
      this.decor.add(g);
    }
  }

  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) return;
    for (const c of this.clouds) {
      c.position.x += dt * 0.06;
      if (c.position.x > 24) c.position.x -= 30;
    }
  }
}

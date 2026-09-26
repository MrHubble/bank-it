import * as THREE from "three";
import type { Preview } from "../sim/preview.ts";
import type { Vec2 } from "../sim/types.ts";
import { INK } from "./materials.ts";

const MAX_DOTS = 40;
const GHOST_MAX = 1400;

function powerColor(p: number): THREE.Color {
  const a = new THREE.Color("#ffd23f");
  const b = new THREE.Color("#ff6b2c");
  const c = new THREE.Color("#e4232d");
  return p < 0.6 ? a.lerp(b, p / 0.6) : b.lerp(c, (p - 0.6) / 0.4);
}

/**
 * Aiming visuals, all drawn on top of the scene in the play plane:
 * the launch arrow (length and colour show power), the short dotted preview
 * with a marker at the first predicted contact, and the faint ghost of the
 * previous shot's full path.
 */
export class AimView {
  readonly object = new THREE.Group();
  private readonly arrow = new THREE.Group();
  private readonly shaft: THREE.Mesh;
  private readonly shaftInk: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly headInk: THREE.Mesh;
  private readonly dots: THREE.InstancedMesh;
  private readonly dotsInk: THREE.InstancedMesh;
  private readonly marker: THREE.Group;
  private readonly ghost: THREE.Line;
  private readonly ghostPos: Float32Array;
  private readonly tmp = new THREE.Object3D();
  private markerT = 0;

  constructor() {
    const top = (m: THREE.Material) => {
      m.depthTest = false;
      m.depthWrite = false;
      m.transparent = true;
      return m;
    };
    const fill = top(new THREE.MeshBasicMaterial({ color: "#ffd23f" }));
    const ink = top(new THREE.MeshBasicMaterial({ color: INK }));
    const shaftGeo = new THREE.PlaneGeometry(1, 1);
    shaftGeo.translate(0.5, 0, 0);
    this.shaftInk = new THREE.Mesh(shaftGeo, ink);
    this.shaft = new THREE.Mesh(shaftGeo, fill);
    const tri = new THREE.Shape();
    tri.moveTo(0, -0.5);
    tri.lineTo(1, 0);
    tri.lineTo(0, 0.5);
    tri.closePath();
    const headGeo = new THREE.ShapeGeometry(tri);
    this.headInk = new THREE.Mesh(headGeo, ink);
    this.head = new THREE.Mesh(headGeo, fill);
    this.arrow.add(this.shaftInk, this.headInk, this.shaft, this.head);
    this.arrow.renderOrder = 20;
    this.arrow.children.forEach((c, i) => (c.renderOrder = 20 + (i < 2 ? 0 : 1)));
    this.object.add(this.arrow);

    const dotGeo = new THREE.CircleGeometry(1, 12);
    this.dotsInk = new THREE.InstancedMesh(dotGeo, top(new THREE.MeshBasicMaterial({ color: INK })), MAX_DOTS);
    this.dots = new THREE.InstancedMesh(dotGeo, top(new THREE.MeshBasicMaterial({ color: "#ffffff" })), MAX_DOTS);
    this.dotsInk.renderOrder = 18;
    this.dots.renderOrder = 19;
    this.dots.frustumCulled = false;
    this.dotsInk.frustumCulled = false;
    this.object.add(this.dotsInk, this.dots);

    this.marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 20), top(new THREE.MeshBasicMaterial({ color: "#ffffff" })));
    const ringInk = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.19, 20), top(new THREE.MeshBasicMaterial({ color: INK })));
    ringInk.renderOrder = 18;
    ring.renderOrder = 19;
    this.marker.add(ringInk, ring);
    this.object.add(this.marker);

    this.ghostPos = new Float32Array(GHOST_MAX * 3);
    const ghostGeo = new THREE.BufferGeometry();
    ghostGeo.setAttribute("position", new THREE.BufferAttribute(this.ghostPos, 3));
    ghostGeo.setDrawRange(0, 0);
    this.ghost = new THREE.Line(
      ghostGeo,
      top(new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.14, gapSize: 0.12, opacity: 0.55 })),
    );
    this.ghost.renderOrder = 15;
    this.ghost.frustumCulled = false;
    this.object.add(this.ghost);
    this.hideAim();
  }

  showAim(from: Vec2, angleRad: number, power: number, preview: Preview, active: boolean): void {
    const len = 0.55 + power * 1.55;
    const w = active ? 0.1 : 0.075;
    this.arrow.visible = true;
    this.arrow.position.set(from.x, from.y, 0.5);
    this.arrow.rotation.z = angleRad;
    const start = 0.34;
    this.shaft.position.x = start;
    this.shaft.scale.set(len, w, 1);
    this.shaftInk.position.x = start - 0.03;
    this.shaftInk.scale.set(len + 0.06, w + 0.06, 1);
    this.head.position.x = start + len;
    this.head.scale.set(0.3, 0.3, 1);
    this.headInk.position.x = start + len - 0.04;
    this.headInk.scale.set(0.4, 0.42, 1);
    const col = powerColor(power);
    (this.shaft.material as THREE.MeshBasicMaterial).color.copy(col);
    const opacity = active ? 1 : 0.8;
    for (const m of [this.shaft, this.head, this.shaftInk, this.headInk]) (m.material as THREE.MeshBasicMaterial).opacity = opacity;

    // Dotted preview: every third tick, shrinking along the path.
    const pts = preview.points;
    let n = 0;
    for (let i = 3; i < pts.length && n < MAX_DOTS; i += 3) {
      const t = i / Math.max(1, pts.length);
      const r = 0.055 * (1 - t * 0.45);
      this.tmp.position.set(pts[i].x, pts[i].y, 0.4);
      this.tmp.scale.setScalar(r);
      this.tmp.updateMatrix();
      this.dots.setMatrixAt(n, this.tmp.matrix);
      this.tmp.scale.setScalar(r + 0.025);
      this.tmp.updateMatrix();
      this.dotsInk.setMatrixAt(n, this.tmp.matrix);
      n++;
    }
    this.dots.count = n;
    this.dotsInk.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    this.dotsInk.instanceMatrix.needsUpdate = true;
    this.dots.visible = this.dotsInk.visible = true;
    if (preview.hit) {
      this.marker.visible = true;
      this.marker.position.set(preview.hit.point.x, preview.hit.point.y, 0.45);
    } else {
      this.marker.visible = false;
    }
  }

  hideAim(): void {
    this.arrow.visible = false;
    this.dots.visible = false;
    this.dotsInk.visible = false;
    this.marker.visible = false;
  }

  setGhost(path: Vec2[] | null): void {
    const geo = this.ghost.geometry;
    if (!path || path.length < 2) {
      geo.setDrawRange(0, 0);
      return;
    }
    const n = Math.min(GHOST_MAX, path.length);
    for (let i = 0; i < n; i++) this.ghostPos.set([path[i].x, path[i].y, 0.3], i * 3);
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    geo.setDrawRange(0, n);
    geo.computeBoundingSphere();
    this.ghost.computeLineDistances();
  }

  setGhostVisible(v: boolean): void {
    this.ghost.visible = v;
  }

  update(dt: number): void {
    this.markerT += dt;
    const s = 1 + Math.sin(this.markerT * 8) * 0.12;
    this.marker.scale.setScalar(s);
  }
}

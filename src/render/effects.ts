import * as THREE from "three";
import type { Vec2 } from "../sim/types.ts";
import type { ObliqueCamera } from "./camera.ts";

// Short, cheap effects: pooled instanced particles, comic captions (HTML so
// they use the studio fonts) and a small screen shake that respects reduced
// motion. Everything here is cosmetic and never touches the simulation.

export type ParticleKind = "dust" | "chip" | "feather" | "confetti" | "spark";

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  spin: number;
  size: number;
  life: number;
  age: number;
  gravity: number;
  drag: number;
  sway: number;
  color: THREE.Color;
}

interface Pool {
  mesh: THREE.InstancedMesh;
  items: Particle[];
  grow: boolean;
}

export interface BurstOptions {
  count: number;
  speed: number;
  /** Base direction in radians; particles spread around it. */
  dir?: number;
  spread?: number;
  colors: THREE.ColorRepresentation[];
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  sway?: number;
  z?: number;
}

export type CaptionTone = "boing" | "clang" | "bird" | "roof" | "board" | "brolly" | "good" | "great" | "legend" | "miss" | "near" | "info";

const MAX = 90;

export class Effects {
  readonly group = new THREE.Group();
  reducedMotion = false;
  private readonly pools = new Map<ParticleKind, Pool>();
  private readonly layer: HTMLElement;
  private readonly camera: ObliqueCamera;
  private size = { w: 1, h: 1 };
  private shakeTime = 0;
  private shakeAmp = 0;
  private seed = 1;
  private readonly tmp = new THREE.Object3D();

  constructor(camera: ObliqueCamera, captionLayer: HTMLElement) {
    this.camera = camera;
    this.layer = captionLayer;
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const feather = new THREE.CircleGeometry(1, 10);
    feather.scale(1, 0.32, 1);
    this.addPool("dust", new THREE.CircleGeometry(1, 10), true);
    this.addPool("chip", new THREE.PlaneGeometry(1, 0.6), false);
    this.addPool("feather", feather, false);
    this.addPool("confetti", new THREE.PlaneGeometry(1, 0.55), false);
    this.addPool("spark", new THREE.ShapeGeometry(star), false);
  }

  private addPool(kind: ParticleKind, geometry: THREE.BufferGeometry, grow: boolean): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: kind === "dust", opacity: kind === "dust" ? 0.8 : 1 });
    const mesh = new THREE.InstancedMesh(geometry, mat, MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    const items: Particle[] = [];
    for (let i = 0; i < MAX; i++) {
      items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, size: 0, life: 1, age: 0, gravity: 0, drag: 0, sway: 0, color: new THREE.Color() });
      mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.group.add(mesh);
    this.pools.set(kind, { mesh, items, grow });
  }

  /** Cheap deterministic-ish randomness for cosmetic spread. */
  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  setViewport(w: number, h: number): void {
    this.size = { w, h };
  }

  burst(kind: ParticleKind, at: Vec2, o: BurstOptions): void {
    const pool = this.pools.get(kind)!;
    const count = this.reducedMotion ? Math.ceil(o.count * 0.6) : o.count;
    for (let n = 0; n < count; n++) {
      const p = pool.items.find((q) => !q.alive);
      if (!p) break;
      const dir = (o.dir ?? Math.PI / 2) + (this.rand() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = o.speed * (0.45 + this.rand() * 0.75);
      p.alive = true;
      p.x = at.x + (this.rand() - 0.5) * 0.1;
      p.y = at.y + (this.rand() - 0.5) * 0.1;
      p.z = (o.z ?? 0.35) + (this.rand() - 0.5) * 0.4;
      p.vx = Math.cos(dir) * sp;
      p.vy = Math.sin(dir) * sp;
      p.vz = (this.rand() - 0.5) * 0.6;
      p.rot = this.rand() * Math.PI * 2;
      p.spin = (this.rand() - 0.5) * 14;
      p.size = (o.size ?? 0.08) * (0.7 + this.rand() * 0.6);
      p.life = (o.life ?? 0.7) * (0.75 + this.rand() * 0.5);
      p.age = 0;
      p.gravity = o.gravity ?? -9;
      p.drag = o.drag ?? 1.5;
      p.sway = o.sway ?? 0;
      p.color.set(o.colors[Math.floor(this.rand() * o.colors.length)]);
    }
  }

  caption(text: string, at: Vec2, tone: CaptionTone, size: "sm" | "md" | "lg" = "md"): void {
    const s = this.camera.toScreen(at.x, at.y, this.size.w, this.size.h);
    const el = document.createElement("div");
    el.className = `caption caption--${tone} caption--${size}`;
    el.textContent = text;
    const tilt = (this.rand() - 0.5) * 14;
    el.style.left = `${Math.min(this.size.w - 40, Math.max(40, s.x))}px`;
    el.style.top = `${Math.min(this.size.h - 30, Math.max(60, s.y))}px`;
    el.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
    this.layer.appendChild(el);
    const ttl = size === "lg" ? 1500 : 1000;
    window.setTimeout(() => el.remove(), ttl);
  }

  shake(amount: number): void {
    if (this.reducedMotion) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeTime = 0.35;
  }

  /** Current camera offset from screen shake. */
  shakeOffset(): Vec2 {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const k = this.shakeAmp * (this.shakeTime / 0.35);
    return { x: (this.rand() - 0.5) * k, y: (this.rand() - 0.5) * k };
  }

  update(dt: number): void {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakeAmp = 0;
    for (const [, pool] of this.pools) {
      let n = 0;
      for (const p of pool.items) {
        if (!p.alive) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          continue;
        }
        p.vy += p.gravity * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += (p.vx + Math.sin(p.age * 7 + p.rot) * p.sway) * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rot += p.spin * dt;
        const t = p.age / p.life;
        const s = pool.grow ? p.size * (1 + t * 1.6) * (1 - t * t) : p.size * (t > 0.75 ? (1 - t) / 0.25 : 1);
        this.tmp.position.set(p.x, p.y, p.z);
        this.tmp.rotation.set(0, 0, p.rot);
        this.tmp.scale.setScalar(Math.max(0.0001, s));
        this.tmp.updateMatrix();
        pool.mesh.setMatrixAt(n, this.tmp.matrix);
        pool.mesh.setColorAt(n, p.color);
        n++;
      }
      pool.mesh.count = n;
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear(): void {
    for (const [, pool] of this.pools) {
      for (const p of pool.items) p.alive = false;
      pool.mesh.count = 0;
    }
    this.layer.replaceChildren();
  }
}

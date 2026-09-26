import * as THREE from "three";
import { BALL_RADIUS } from "../sim/constants.ts";
import type { Vec2 } from "../sim/types.ts";
import { part, toonUnique } from "./materials.ts";

const TRAIL_POINTS = 14;

function basketballTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#f58a3a");
  grad.addColorStop(1, "#e8641f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  // Pebble texture.
  g.fillStyle = "rgba(120,40,0,0.12)";
  for (let i = 0; i < 700; i++) g.fillRect((i * 97) % 256, (i * 57) % 128, 2, 2);
  g.strokeStyle = "#2a1408";
  g.lineWidth = 5;
  g.lineCap = "round";
  const line = (pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  };
  line([[0, 64], [256, 64]]);
  line([[64, 0], [64, 128]]);
  line([[192, 0], [192, 128]]);
  for (const cx of [0, 128, 256]) {
    const pts: [number, number][] = [];
    for (let y = 0; y <= 128; y += 4) pts.push([cx + Math.sin((y / 128) * Math.PI) * 34 * (cx === 128 ? 1 : cx === 0 ? 1 : -1), y]);
    line(pts);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/**
 * The basketball: toon-shaded with seams, spins with the physics (plus a
 * visual backspin in flight), squashes briefly on impact, casts a blob
 * shadow on the driveway and leaves a short trail when it is moving fast.
 */
export class BallView {
  readonly object = new THREE.Group();
  private readonly squash = new THREE.Group();
  private readonly spin = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly trail: THREE.Mesh;
  private readonly trailPos: Float32Array;
  private readonly trailAlpha: Float32Array;
  private readonly history: Vec2[] = [];
  private squashT = 1;
  private squashAngle = 0;
  private squashAmt = 0;
  private visualSpin = 0;
  private spinRate = 0;
  private popT = 1;

  constructor() {
    const mat = toonUnique("#ffffff", { map: basketballTexture() });
    const ball = part(new THREE.SphereGeometry(BALL_RADIUS, 28, 18), mat, { outline: 0.022 });
    ball.rotation.x = 0.35;
    this.spin.add(ball);
    this.squash.add(this.spin);
    this.object.add(this.squash);
    this.object.name = "ball";

    const shadowGeo = new THREE.CircleGeometry(BALL_RADIUS * 1.05, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: "#3a2a1c", transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadow.renderOrder = 1;

    const geo = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(TRAIL_POINTS * 2 * 3);
    this.trailAlpha = new Float32Array(TRAIL_POINTS * 2);
    geo.setAttribute("position", new THREE.BufferAttribute(this.trailPos, 3));
    geo.setAttribute("alpha", new THREE.BufferAttribute(this.trailAlpha, 1));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_POINTS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    const trailMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color("#fff1c9") } },
      vertexShader: "attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, vA * 0.75); }",
    });
    this.trail = new THREE.Mesh(geo, trailMat);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 2;
  }

  get extras(): THREE.Object3D[] {
    return [this.shadow, this.trail];
  }

  /** Put the ball back in the kid's hands with a little pop. */
  place(p: Vec2): void {
    this.history.length = 0;
    this.visualSpin = 0;
    this.spinRate = 0;
    this.squashT = 1;
    this.popT = 0;
    this.set(p, 0, 0, 1 / 60, false);
  }

  launch(vx: number): void {
    // Backspin: top of the ball rolls back towards the shooter.
    this.spinRate = vx >= 0 ? 9 : -9;
  }

  impact(normal: Vec2, speed: number): void {
    this.squashAngle = Math.atan2(normal.y, normal.x);
    this.squashAmt = Math.min(0.28, speed * 0.022);
    this.squashT = 0;
    this.spinRate *= 0.3;
  }

  set(p: Vec2, angle: number, speed: number, dt: number, flying: boolean): void {
    this.object.position.set(p.x, p.y, 0);
    this.visualSpin += this.spinRate * dt;
    this.spinRate *= Math.exp(-dt * 0.8);
    this.spin.rotation.z = angle + this.visualSpin;
    // Squash along the contact normal.
    this.squashT = Math.min(1, this.squashT + dt / 0.12);
    const s = this.squashAmt * Math.sin(this.squashT * Math.PI) * (1 - this.squashT * 0.3);
    this.squash.rotation.z = this.squashAngle;
    this.spin.rotation.z -= this.squashAngle;
    this.popT = Math.min(1, this.popT + dt / 0.22);
    const pop = this.popT < 1 ? 0.6 + 0.4 * Math.sin((this.popT * Math.PI) / 2) + Math.sin(this.popT * Math.PI) * 0.15 : 1;
    this.squash.scale.set((1 - s) * pop, (1 + s * 0.6) * pop, (1 + s * 0.6) * pop);
    // Blob shadow on the driveway, fading with height.
    const h = Math.max(0, p.y - BALL_RADIUS);
    this.shadow.position.set(p.x, 0.012, 0);
    const k = 1 / (1 + h * 0.45);
    this.shadow.scale.setScalar(0.7 + (1 - k) * 0.9);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.34 * k;
    // Trail.
    if (flying) this.history.unshift({ x: p.x, y: p.y });
    if (this.history.length > TRAIL_POINTS) this.history.length = TRAIL_POINTS;
    const fast = flying ? Math.min(1, Math.max(0, (speed - 8) / 6)) : 0;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const q = this.history[Math.min(i, this.history.length - 1)] ?? p;
      const n = this.history[Math.min(i + 1, this.history.length - 1)] ?? q;
      let dx = q.x - n.x;
      let dy = q.y - n.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const w = BALL_RADIUS * 0.85 * (1 - i / TRAIL_POINTS);
      const a = fast * (1 - i / TRAIL_POINTS);
      this.trailPos.set([q.x - dy * w, q.y + dx * w, -0.05, q.x + dy * w, q.y - dx * w, -0.05], i * 6);
      this.trailAlpha[i * 2] = a;
      this.trailAlpha[i * 2 + 1] = a;
    }
    (this.trail.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.trail.geometry.getAttribute("alpha") as THREE.BufferAttribute).needsUpdate = true;
  }

  setVisible(v: boolean): void {
    this.object.visible = v;
    this.shadow.visible = v;
    this.trail.visible = v;
  }
}

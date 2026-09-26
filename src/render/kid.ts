import * as THREE from "three";
import type { Vec2 } from "../sim/types.ts";
import { part, toon } from "./materials.ts";

export type KidPose = "ready" | "aim" | "throw" | "watch" | "cheer" | "groan" | "facepalm";

interface Joints {
  lean: number;
  armL: number;
  armR: number;
  elbow: number;
  head: number;
  hop: number;
}

const POSES: Record<KidPose, Joints> = {
  ready: { lean: 0, armL: 2.3, armR: 2.2, elbow: 0.5, head: 0.15, hop: 0 },
  aim: { lean: -0.12, armL: 2.6, armR: 2.5, elbow: 0.9, head: 0.25, hop: 0 },
  throw: { lean: 0.12, armL: 2.0, armR: 1.9, elbow: 0, head: 0.3, hop: 0 },
  watch: { lean: 0.04, armL: 0.5, armR: 1.2, elbow: 0.2, head: 0.35, hop: 0 },
  cheer: { lean: 0, armL: 2.8, armR: 2.8, elbow: 0.1, head: 0.35, hop: 1 },
  groan: { lean: -0.05, armL: 2.9, armR: 2.9, elbow: 2.2, head: -0.1, hop: 0 },
  facepalm: { lean: 0.08, armL: 0.3, armR: 2.2, elbow: 2.4, head: -0.35, hop: 0 },
};

/** The shooter: a small LeoToby kid in a backwards cap. Decorative only. */
export class Kid {
  readonly object = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly chest = new THREE.Group();
  private readonly headPivot = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly foreL = new THREE.Group();
  private readonly foreR = new THREE.Group();
  private pose: KidPose = "ready";
  private cur: Joints = { ...POSES.ready };
  private poseTime = 0;
  private aimPower = 0;

  constructor(launch: Vec2) {
    const skin = toon("#f1c08e");
    const tee = toon("#e8397f");
    const shorts = toon("#2b3a67");
    const cap = toon("#6ec3ff");
    const shoe = toon("#fbfbf8");
    this.object.position.set(launch.x - 0.62, 0, -0.5);
    this.object.name = "kid";
    // Legs and shoes.
    for (const z of [0.09, -0.09]) {
      const leg = part(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 8), skin, { outline: 0.018 });
      leg.position.set(0, 0.3, z);
      const sh = part(new THREE.BoxGeometry(0.24, 0.09, 0.12), shoe, { outline: 0.018 });
      sh.position.set(0.05, 0.05, z);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.125), toon("#e4432d"));
      stripe.position.set(0.05, 0.06, z);
      this.object.add(leg, sh, stripe);
    }
    this.hips.position.set(0, 0.55, 0);
    this.object.add(this.hips);
    const sh = part(new THREE.CylinderGeometry(0.17, 0.16, 0.2, 12), shorts, { outline: 0.02 });
    sh.position.y = 0.04;
    this.hips.add(sh);
    this.chest.position.y = 0.12;
    this.hips.add(this.chest);
    const torso = part(new THREE.CapsuleGeometry(0.16, 0.22, 4, 12), tee, { outline: 0.022 });
    torso.position.y = 0.2;
    this.chest.add(torso);
    const number = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), toon("#fbf8f0"));
    number.position.set(0.02, 0.24, 0.16);
    this.chest.add(number);
    this.headPivot.position.set(0.02, 0.5, 0);
    this.chest.add(this.headPivot);
    const head = part(new THREE.SphereGeometry(0.19, 16, 12), skin, { outline: 0.022 });
    head.position.y = 0.16;
    this.headPivot.add(head);
    const capTop = part(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, { outline: 0.02 });
    capTop.position.y = 0.2;
    capTop.rotation.z = 0.12;
    this.headPivot.add(capTop);
    const brim = part(new THREE.BoxGeometry(0.2, 0.03, 0.22), cap, { outline: 0.015 });
    brim.position.set(-0.22, 0.22, 0);
    this.headPivot.add(brim);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), toon("#161513"));
    eye.position.set(0.13, 0.19, 0.12);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), skin);
    nose.position.set(0.19, 0.14, 0.02);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10, Math.PI), toon("#161513"));
    smile.position.set(0.14, 0.08, 0.1);
    smile.rotation.set(0, 0.6, Math.PI);
    this.headPivot.add(eye, nose, smile);
    // Arms: shoulder pivots with a forearm each.
    const makeArm = (pivot: THREE.Group, fore: THREE.Group, z: number) => {
      pivot.position.set(0.02, 0.4, z);
      const upper = part(new THREE.CapsuleGeometry(0.045, 0.18, 4, 8), tee, { outline: 0.016 });
      upper.position.y = -0.12;
      pivot.add(upper);
      fore.position.y = -0.24;
      pivot.add(fore);
      const lower = part(new THREE.CapsuleGeometry(0.04, 0.17, 4, 8), skin, { outline: 0.016 });
      lower.position.y = -0.11;
      fore.add(lower);
      this.chest.add(pivot);
    };
    makeArm(this.armL, this.foreL, -0.2);
    makeArm(this.armR, this.foreR, 0.2);
  }

  setPose(p: KidPose): void {
    if (p === this.pose) return;
    this.pose = p;
    this.poseTime = 0;
  }

  setAimPower(power: number): void {
    this.aimPower = power;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.poseTime += dt;
    const target = POSES[this.pose];
    const k = 1 - Math.exp(-dt * (this.pose === "throw" ? 30 : 12));
    const c = this.cur;
    for (const key of Object.keys(c) as (keyof Joints)[]) c[key] += (target[key] - c[key]) * k;
    const breathe = reducedMotion ? 0 : Math.sin(this.poseTime * 3) * 0.02;
    const lean = c.lean - (this.pose === "aim" ? this.aimPower * 0.18 : 0);
    this.hips.rotation.z = lean;
    this.chest.rotation.z = breathe;
    this.headPivot.rotation.z = c.head;
    this.armL.rotation.z = c.armL;
    this.armR.rotation.z = c.armR + (this.pose === "cheer" && !reducedMotion ? Math.sin(this.poseTime * 14) * 0.25 : 0);
    this.foreL.rotation.z = c.elbow;
    this.foreR.rotation.z = c.elbow;
    const hop = reducedMotion ? 0 : c.hop * Math.abs(Math.sin(this.poseTime * 7)) * 0.22;
    this.object.position.y = hop;
  }
}

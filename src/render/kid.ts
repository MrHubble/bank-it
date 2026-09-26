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
    const ink = toon("#161513");
    this.object.position.set(launch.x - 0.62, 0, -0.5);
    this.object.name = "kid";
    // Legs and chunky sneakers.
    for (const z of [0.1, -0.1]) {
      const leg = part(new THREE.CylinderGeometry(0.07, 0.062, 0.46, 10), skin, { outline: 0.02 });
      leg.position.set(0, 0.32, z);
      const sh = part(new THREE.CapsuleGeometry(0.075, 0.16, 4, 10), shoe, { outline: 0.02 });
      sh.rotation.z = Math.PI / 2;
      sh.position.set(0.06, 0.075, z);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.155), toon("#e4432d"));
      stripe.position.set(0.05, 0.09, z);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.08, 10), toon("#fbf8f0"));
      sock.position.set(0, 0.17, z);
      this.object.add(leg, sh, stripe, sock);
    }
    this.hips.position.set(0, 0.56, 0);
    this.object.add(this.hips);
    const sh = part(new THREE.CylinderGeometry(0.2, 0.19, 0.24, 14), shorts, { outline: 0.022 });
    sh.position.y = 0.02;
    this.hips.add(sh);
    this.chest.position.y = 0.12;
    this.hips.add(this.chest);
    const torso = part(new THREE.CapsuleGeometry(0.19, 0.2, 4, 14), tee, { outline: 0.024 });
    torso.position.y = 0.2;
    this.chest.add(torso);
    // Race-plate number on the tee.
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), toon("#fbf8f0"));
    plate.position.set(0.05, 0.22, 0.19);
    this.chest.add(plate);
    this.headPivot.position.set(0.02, 0.5, 0);
    this.chest.add(this.headPivot);
    const head = part(new THREE.SphereGeometry(0.22, 18, 14), skin, { outline: 0.024 });
    head.position.y = 0.17;
    this.headPivot.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), toon("#6b4226"));
    hair.scale.set(1.2, 0.6, 1.6);
    hair.position.set(0.14, 0.3, 0.02);
    this.headPivot.add(hair);
    const capTop = part(new THREE.SphereGeometry(0.228, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, { outline: 0.022 });
    capTop.position.y = 0.21;
    capTop.rotation.z = 0.14;
    this.headPivot.add(capTop);
    const brim = part(new THREE.BoxGeometry(0.22, 0.035, 0.24), cap, { outline: 0.016 });
    brim.position.set(-0.25, 0.23, 0);
    brim.rotation.z = -0.12;
    this.headPivot.add(brim);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), ink);
    eye.scale.set(0.8, 1.2, 0.6);
    eye.position.set(0.15, 0.2, 0.15);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), toon("#6b4226"));
    brow.position.set(0.15, 0.27, 0.16);
    brow.rotation.z = 0.15;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skin);
    nose.position.set(0.215, 0.15, 0.03);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), toon("#f59aa8"));
    cheek.position.set(0.11, 0.11, 0.19);
    cheek.rotation.y = 0.5;
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 4, 12, Math.PI), ink);
    smile.position.set(0.16, 0.08, 0.12);
    smile.rotation.set(0, 0.6, Math.PI);
    this.headPivot.add(eye, brow, nose, cheek, smile);
    // Arms: shoulder pivots with a forearm and hand each.
    const makeArm = (pivot: THREE.Group, fore: THREE.Group, z: number) => {
      pivot.position.set(0.02, 0.4, z);
      const upper = part(new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), tee, { outline: 0.018 });
      upper.position.y = -0.12;
      pivot.add(upper);
      fore.position.y = -0.25;
      pivot.add(fore);
      const lower = part(new THREE.CapsuleGeometry(0.05, 0.15, 4, 10), skin, { outline: 0.018 });
      lower.position.y = -0.1;
      fore.add(lower);
      const hand = part(new THREE.SphereGeometry(0.06, 10, 8), skin, { outline: 0.016 });
      hand.position.y = -0.21;
      fore.add(hand);
      this.chest.add(pivot);
    };
    makeArm(this.armL, this.foreL, -0.24);
    makeArm(this.armR, this.foreR, 0.24);
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

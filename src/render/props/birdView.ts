import * as THREE from "three";
import { birdPosition } from "../../props/bird.ts";
import type { BirdDef } from "../../props/defs.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";
import { addOutline, part, toon } from "../materials.ts";
import type { PropView, PropViewFactory, ViewFrame } from "./types.ts";

const GROUND_Y = 0.2;

/**
 * Seagull on patrol. When the ball clips it: squawk, feathers, a tumble to the
 * driveway, a daze with circling stars, an offended glare, then it flaps off.
 * All of this is cosmetic; the sim switches the bird's collider off on impact.
 */
export const birdView: PropViewFactory<BirdDef> = {
  create(def) {
    const root = new THREE.Group();
    root.name = def.id;
    const flip = new THREE.Group(); // mirrors to face the direction of travel
    root.add(flip);
    const body = new THREE.Group(); // tumbles
    flip.add(body);
    const white = toon("#fbfbf8");
    const grey = toon("#aeb9c4");
    const dark = toon("#33373e");
    const s = def.radius / 0.42;

    const torso = part(new THREE.SphereGeometry(0.3, 16, 12), white, { outline: 0.025 });
    torso.scale.set(1.45, 0.92, 0.95);
    body.add(torso);
    const head = part(new THREE.SphereGeometry(0.2, 14, 10), white, { outline: 0.025 });
    head.position.set(0.36, 0.2, 0);
    body.add(head);
    const beak = part(new THREE.ConeGeometry(0.06, 0.24, 8), toon("#ffc53d"), { outline: 0.012 });
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.6, 0.16, 0);
    body.add(beak);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), toon("#e4432d"));
    spot.position.set(0.62, 0.13, 0.03);
    body.add(spot);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), toon("#161513"));
    eye.position.set(0.46, 0.27, 0.15);
    body.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), toon("#ffffff"));
    glint.position.set(0.475, 0.285, 0.185);
    body.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), toon("#161513"));
    brow.position.set(0.46, 0.34, 0.17);
    brow.rotation.z = -0.45;
    brow.visible = false;
    body.add(brow);
    const tail = part(new THREE.ConeGeometry(0.12, 0.3, 4), grey, { outline: 0.015 });
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.5, 0.06, 0);
    body.add(tail);
    const makeWing = (z: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.02, 0.14, z);
      const shape = new THREE.Shape();
      shape.moveTo(0.18, 0);
      shape.quadraticCurveTo(0.05, 0.12, -0.36, 0.02);
      shape.lineTo(-0.52, -0.05);
      shape.quadraticCurveTo(-0.1, -0.1, 0.18, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const wing = part(geo, grey, { outline: 0.015 });
      wing.scale.set(1, 1, z > 0 ? 1.9 : -1.9);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), dark);
      tip.position.set(-0.4, 0.0, z > 0 ? 0.62 : -0.62);
      pivot.add(wing, tip);
      body.add(pivot);
      return pivot;
    };
    const nearWing = makeWing(0.12);
    const farWing = makeWing(-0.12);
    const legs: THREE.Mesh[] = [];
    for (const z of [0.08, -0.08]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), toon("#f28c28"));
      leg.position.set(-0.02, -0.3, z);
      legs.push(leg);
      body.add(leg);
    }
    // Stars for the daze.
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.045 : 0.1;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const stars = new THREE.Group();
    const starMat = toon("#ffd23f");
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.ShapeGeometry(starShape), starMat);
      addOutline(st, 0.012);
      stars.add(st);
    }
    stars.visible = false;
    root.add(stars);
    root.scale.setScalar(s);

    // Faint patrol lane so the path is readable.
    const lane: number[] = [];
    for (let t = 0; t <= def.path.period / 2; t += 3) {
      const p = birdPosition(def.path, Math.round(t - def.path.start * def.path.period));
      lane.push(p.x, p.y, -0.6);
    }
    const laneGeo = new THREE.BufferGeometry();
    laneGeo.setAttribute("position", new THREE.Float32BufferAttribute(lane, 3));
    const laneLine = new THREE.Line(laneGeo, new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.12, gapSize: 0.16, transparent: true, opacity: 0.4 }));
    laneLine.computeLineDistances();

    // Sequence after a hit (seconds since the hit).
    let hitAt = -1;
    let t = 0;
    let fall = { x: 0, y: 0, vx: 0, vy: 0, landed: -1 };
    let facing = 1;
    let fx: Effects | null = null;
    let saidOi = false;
    let leaveDir = 1;

    const view: PropView = {
      def,
      object: root,
      anchor: () => ({ x: root.position.x, y: root.position.y + 0.6 }),
      onEvent(e: SimEvent, effects: Effects) {
        if (e.type !== "bird-hit" || e.objectId !== def.id) return;
        fx = effects;
        hitAt = 0;
        t = 0;
        saidOi = false;
        fall = { x: root.position.x, y: root.position.y, vx: -facing * 0.6, vy: 2.4, landed: -1 };
        leaveDir = root.position.x > 8 ? 1 : -1;
        effects.burst("feather", { x: root.position.x, y: root.position.y }, {
          count: 7,
          speed: 2.6,
          colors: ["#ffffff", "#e8edf2", "#aeb9c4"],
          size: 0.13,
          life: 1.4,
          gravity: -1.2,
          drag: 2.2,
          sway: 0.9,
        });
      },
      update(f: ViewFrame) {
        const flap = (speed: number, amp: number) => {
          const w = f.reducedMotion ? 0.2 : Math.sin(f.time * speed);
          nearWing.rotation.x = -0.25 + w * amp;
          farWing.rotation.x = 0.25 - w * amp;
        };
        if (hitAt < 0) {
          // On patrol.
          const p = birdPosition(def.path, f.phase);
          const q = birdPosition(def.path, f.phase + 1);
          if (Math.abs(q.x - p.x) > 1e-4) facing = q.x > p.x ? 1 : -1;
          root.position.set(p.x, p.y, 0);
          flip.scale.x = facing;
          body.rotation.set(0, 0, (q.y - p.y) * 3);
          flap(11, 0.55);
          legs.forEach((l) => (l.visible = false));
          brow.visible = false;
          stars.visible = false;
          return;
        }
        t += f.dt;
        if (fall.landed < 0) {
          // Tumbling down.
          fall.vy -= 13 * f.dt;
          fall.x += fall.vx * f.dt;
          fall.y += fall.vy * f.dt;
          body.rotation.z += f.dt * 11 * -facing;
          flap(30, 0.9);
          if (fall.y <= GROUND_Y) {
            fall.y = GROUND_Y;
            fall.landed = t;
            fx?.burst("dust", { x: fall.x, y: 0.05 }, { count: 5, speed: 1, dir: Math.PI / 2, spread: 2.6, colors: ["#e9dcc6"], size: 0.1, life: 0.5, gravity: 0.3 });
          }
          root.position.set(fall.x, fall.y, 0);
          return;
        }
        const since = t - fall.landed;
        if (since < 1.05) {
          // Flat on its back, seeing stars.
          body.rotation.z = Math.PI * 0.92 * -facing;
          root.position.set(fall.x, GROUND_Y + 0.08, 0);
          nearWing.rotation.x = -0.9;
          farWing.rotation.x = 0.9;
          legs.forEach((l) => (l.visible = true));
          stars.visible = true;
          stars.position.set(0, 0.5, 0.3);
          stars.children.forEach((st, i) => {
            const a = t * 5 + (i * Math.PI * 2) / 3;
            st.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.08, Math.sin(a) * 0.2);
            st.rotation.z = t * 4;
          });
          return;
        }
        stars.visible = false;
        if (since < 1.75) {
          // Up on its feet, glaring.
          body.rotation.z = 0;
          facing = -leaveDir;
          flip.scale.x = facing;
          root.position.set(fall.x, 0.4 + Math.abs(Math.sin(since * 20)) * 0.03, 0);
          brow.visible = true;
          legs.forEach((l) => (l.visible = true));
          nearWing.rotation.x = -0.1;
          farWing.rotation.x = 0.1;
          body.scale.setScalar(1 + Math.max(0, Math.sin((since - 1.05) * 9)) * 0.08);
          if (!saidOi && fx) {
            saidOi = true;
            fx.caption("OI!", { x: fall.x, y: 1.3 }, "bird", "sm");
          }
          return;
        }
        // Flaps off in a huff.
        body.scale.setScalar(1);
        const k = since - 1.75;
        facing = leaveDir;
        flip.scale.x = facing;
        root.position.set(fall.x + leaveDir * k * 4.5, 0.4 + k * 3.2, 0);
        body.rotation.z = 0.35;
        legs.forEach((l) => (l.visible = false));
        flap(16, 0.7);
      },
      reset() {
        if (hitAt >= 0 && fx) {
          const p0 = birdPosition(def.path, 0);
          fx.burst("feather", p0, { count: 4, speed: 1.2, colors: ["#ffffff", "#e8edf2"], size: 0.1, life: 0.7, gravity: -0.8, drag: 2, sway: 0.6 });
        }
        hitAt = -1;
        t = 0;
        brow.visible = false;
        stars.visible = false;
        body.rotation.set(0, 0, 0);
        body.scale.setScalar(1);
      },
    };
    // The lane lives outside the bird's transform.
    const holder = new THREE.Group();
    holder.add(root, laneLine);
    return { ...view, object: holder };
  },
};

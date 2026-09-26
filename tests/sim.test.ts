import { beforeAll, describe, expect, it } from "vitest";
import { BIN_THERE } from "../src/levels/layouts.ts";
import { logEvent, newShotLog } from "../src/rules/shotLog.ts";
import { loadRapier, type Rapier } from "../src/sim/rapier.ts";
import { PreviewProbe } from "../src/sim/preview.ts";
import { runShot, ShotSim } from "../src/sim/shot.ts";
import type { Aim } from "../src/sim/types.ts";

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

const shot = (angleTenths: number, powerTenths: number) => ({
  layout: BIN_THERE,
  aim: { angleTenths, powerTenths } as Aim,
  releaseTick: 0,
});

describe("shot simulation", () => {
  it("replays identical shots identically", () => {
    const a = runShot(R, shot(555, 870), { recordPath: true });
    const b = runShot(R, shot(555, 870), { recordPath: true });
    expect(b.path).toEqual(a.path);
    expect(b.events).toEqual(a.events);
  });

  it("is not affected by earlier shots (every shot gets a fresh world)", () => {
    const first = runShot(R, shot(730, 655), { recordPath: true });
    runShot(R, shot(300, 950));
    runShot(R, shot(1200, 400));
    const again = runShot(R, shot(730, 655), { recordPath: true });
    expect(again.path).toEqual(first.path);
  });

  it("scores a direct basket and ends misses", () => {
    expect(runShot(R, shot(450, 700)).scored).toBe(true);
    const miss = runShot(R, shot(300, 400));
    expect(miss.scored).toBe(false);
    expect(["settled", "rolled", "out"]).toContain(miss.endReason);
  });

  it("sends a ball over the fence out of bounds", () => {
    expect(runShot(R, shot(1650, 1000)).endReason).toBe("out");
  });

  it("never leaves a ball in play forever", () => {
    for (let a = 100; a <= 1700; a += 100) {
      for (let p = 0; p <= 1000; p += 250) {
        const res = runShot(R, shot(a, p));
        expect(res.ticks).toBeLessThanOrEqual(120 * 11);
      }
    }
  });

  it("reports one impact per contact while a ball rolls along a surface", () => {
    const res = runShot(R, shot(300, 400));
    const log = newShotLog();
    for (const e of res.events) logEvent(log, e);
    const groundVisits = log.impacts.filter((i) => i.objectId === "ground").length;
    expect(groundVisits).toBeLessThanOrEqual(2);
  });
});

describe("aiming preview", () => {
  it("follows exactly the same launch physics as the real ball", () => {
    const probe = new PreviewProbe(R, BIN_THERE);
    for (const [a, p] of [
      [450, 700],
      [730, 655],
      [300, 950],
      [1350, 800],
    ]) {
      const aim = { angleTenths: a, powerTenths: p };
      const preview = probe.predict(aim, 0);
      const sim = new ShotSim(R, { layout: BIN_THERE, aim, releaseTick: 0 });
      const real = [{ ...sim.pos }];
      for (let i = 1; i < preview.points.length; i++) {
        sim.step();
        real.push({ ...sim.pos });
      }
      sim.dispose();
      expect(real).toEqual(preview.points);
    }
  });

  it("stops at the first predicted contact", () => {
    const probe = new PreviewProbe(R, BIN_THERE);
    // A flat, fast shot hits the driveway within the preview distance.
    const p = probe.predict({ angleTenths: 0, powerTenths: 200 }, 0);
    expect(p.hit?.objectId).toBe("ground");
  });
});

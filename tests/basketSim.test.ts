import { beforeAll, describe, expect, it } from "vitest";
import { HOOP } from "../src/levels/layouts.ts";
import { hoopCentre, type LayoutDef } from "../src/props/defs.ts";
import { loadRapier, type Rapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

const c = hoopCentre(HOOP);
const bare = (launch: { x: number; y: number }): LayoutDef => ({
  id: "test",
  number: "00",
  name: "Test",
  tagline: "",
  launch,
  defaultAim: { angleTenths: 900, powerTenths: 500 },
  props: [HOOP],
  decor: [],
});

describe("basket detection in the real simulation", () => {
  it("rejects a ball that goes up through the hoop from below and falls back through it", () => {
    // Straight up through the middle of the rim, well above it, and back down.
    const layout = bare({ x: c.x, y: 1.0 });
    const res = runShot(R, { layout, aim: { angleTenths: 900, powerTenths: 700 }, releaseTick: 0 }, { recordPath: true });
    const top = Math.max(...res.path.map((p) => p.y));
    expect(top).toBeGreaterThan(HOOP.rimY + 1);
    const crossingsDown = res.path.filter((p, i) => i > 0 && res.path[i - 1].y > HOOP.rimY && p.y <= HOOP.rimY && Math.abs(p.x - c.x) < HOOP.rimHalf);
    expect(crossingsDown.length).toBeGreaterThan(0);
    expect(res.scored).toBe(false);
  });

  it("rejects a ball that comes in through the side of the net", () => {
    const layout = bare({ x: c.x - 3, y: HOOP.rimY - 0.3 });
    const res = runShot(R, { layout, aim: { angleTenths: 0, powerTenths: 450 }, releaseTick: 0 });
    expect(res.scored).toBe(false);
  });

  it("scores a ball dropped in from above", () => {
    const layout = bare({ x: c.x - 1.6, y: HOOP.rimY + 1.2 });
    let made = false;
    for (let a = 300; a <= 900 && !made; a += 20) {
      for (let p = 0; p <= 400 && !made; p += 10) {
        made = runShot(R, { layout, aim: { angleTenths: a, powerTenths: p }, releaseTick: 0 }).scored;
      }
    }
    expect(made).toBe(true);
  });
});

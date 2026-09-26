import { describe, expect, it } from "vitest";
import { basketStep, newBasketTracker, type BasketGeometry } from "../src/sim/basket.ts";
import type { Vec2 } from "../src/sim/types.ts";

const g: BasketGeometry = { cx: 10, rimY: 3, rimHalf: 0.55, tubeR: 0.055, ballR: 0.24 };

/** Feed a polyline of ball centres through the tracker; return every non-null result. */
function trace(points: Vec2[], t = newBasketTracker()) {
  const out: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const r = basketStep(t, g, points[i - 1], points[i]);
    if (r) out.push(r);
  }
  return { out, t };
}

const drop = (x: number, from: number, to: number, step = 0.1): Vec2[] => {
  const pts: Vec2[] = [];
  for (let y = from; y >= to - 1e-9; y -= step) pts.push({ x, y });
  return pts;
};
const rise = (x: number, from: number, to: number, step = 0.1): Vec2[] => drop(x, to, from, step).reverse();

describe("basket detection", () => {
  it("scores a ball that drops through the opening from above", () => {
    expect(trace(drop(10.1, 4, 2)).out).toEqual(["entered", "scored"]);
  });

  it("catches a fast ball that crosses the whole scoring region in one step", () => {
    const { out, t } = trace([{ x: 10, y: 3.2 }, { x: 10.05, y: 2.4 }]);
    expect(out).toEqual(["scored"]);
    expect(t.scored).toBe(true);
  });

  it("rejects a ball that comes up through the hoop from below, even when it falls back in", () => {
    const up = rise(10, 1.5, 4.5);
    const down = drop(10, 4.5, 1.5);
    const { out, t } = trace([...up, ...down]);
    expect(out).toEqual(["upward"]);
    expect(t.scored).toBe(false);
  });

  it("allows a basket again once an upward ball has moved clear of the hoop", () => {
    const path: Vec2[] = [...rise(10, 1.5, 4.5), { x: 11.2, y: 5 }, { x: 10.1, y: 4.2 }, ...drop(10.1, 4, 2)];
    expect(trace(path).out).toEqual(["upward", "entered", "scored"]);
  });

  it("rejects side entries through the net", () => {
    const path: Vec2[] = [];
    for (let x = 8.5; x <= 11.5; x += 0.1) path.push({ x, y: 2.8 - (x - 8.5) * 0.3 });
    expect(trace(path).t.scored).toBe(false);
  });

  it("ignores balls passing outside the rim tubes", () => {
    expect(trace(drop(9.4, 4, 2)).out).toEqual([]);
    expect(trace(drop(10.6, 4, 2)).out).toEqual([]);
  });

  it("does not count a ball that pops back out before dropping through", () => {
    const path: Vec2[] = [{ x: 10.2, y: 3.3 }, { x: 10.2, y: 2.95 }, { x: 10.25, y: 3.2 }, { x: 10.6, y: 3.6 }];
    const { out, t } = trace(path);
    expect(out).toEqual(["entered", "popped-out"]);
    expect(t.scored).toBe(false);
  });

  it("scores only once", () => {
    const t = newBasketTracker();
    const first = trace(drop(10.1, 4, 2), t);
    expect(first.out).toEqual(["entered", "scored"]);
    expect(trace(drop(10.1, 4, 2), t).out).toEqual([]);
  });
});

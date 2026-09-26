import { describe, expect, it } from "vitest";
import { bankedPoints, pendingPoints, scoreChain } from "../src/rules/scoring.ts";
import { impact, play } from "./helpers.ts";
import { logEvent } from "../src/rules/shotLog.ts";

describe("trick-shot scoring", () => {
  it("scores a direct basket at 100", () => {
    expect(bankedPoints(play("BASKET"))).toBe(100);
  });

  it("scores one bin then basket at 200", () => {
    expect(bankedPoints(play("bin > BASKET"))).toBe(200);
  });

  it("scores roof → trampoline → bin → basket at (100 + 300) × 3 = 1,200", () => {
    const s = scoreChain(play("roof > trampoline > bin > BASKET"));
    expect(s).toMatchObject({ objects: 3, subtotal: 400, multiplier: 3, total: 1200 });
  });

  it("adds the +200 bird precision bonus on top of the bird's +100", () => {
    expect(bankedPoints(play("gull > BASKET"))).toBe(400);
    expect(bankedPoints(play("roof > gull > BASKET"))).toBe((100 + 200 + 200) * 2);
  });

  it("adds +50 for a ground bounce once per shot, without raising the multiplier", () => {
    expect(bankedPoints(play("ground > BASKET"))).toBe(150);
    expect(bankedPoints(play("ground > bin > ground > BASKET"))).toBe(250);
  });

  it("ignores repeated contacts with the same object", () => {
    expect(bankedPoints(play("bin > bin > roof > bin > roof > BASKET"))).toBe((100 + 200) * 2);
  });

  it("counts two separate bins as two objects", () => {
    expect(bankedPoints(play("bin > recycling > BASKET"))).toBe((100 + 200) * 2);
  });

  it("gives rim contacts no points and no multiplier", () => {
    expect(bankedPoints(play("rim > rim > BASKET"))).toBe(100);
    expect(bankedPoints(play("roof > rim > BASKET"))).toBe(200);
  });

  it("counts the backboard as an object", () => {
    expect(bankedPoints(play("backboard > BASKET"))).toBe(200);
  });

  it("banks nothing for a miss, however good the chain", () => {
    const log = play("roof > trampoline > bin > gull");
    expect(pendingPoints(log)).toBe((100 + 400 + 200) * 4);
    expect(bankedPoints(log)).toBe(0);
  });

  it("ignores anything that happens after the basket", () => {
    const log = play("bin > BASKET");
    logEvent(log, impact("ground"));
    logEvent(log, impact("roof"));
    expect(bankedPoints(log)).toBe(200);
  });
});

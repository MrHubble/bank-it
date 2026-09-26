import { beforeAll, describe, expect, it } from "vitest";
import { CHALLENGES } from "../src/levels/challenges.ts";
import { LAYOUTS, layoutById } from "../src/levels/layouts.ts";
import { challengeComplete } from "../src/rules/challenges.ts";
import { logEvent, newShotLog } from "../src/rules/shotLog.ts";
import { loadRapier, type Rapier } from "../src/sim/rapier.ts";
import { runShot } from "../src/sim/shot.ts";

let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

describe("called shot solutions", () => {
  it("has challenges on every layout, easiest first", () => {
    for (const l of LAYOUTS) expect(CHALLENGES.some((c) => c.layoutId === l.id)).toBe(true);
    expect(CHALLENGES.map((c) => c.number)).toEqual(CHALLENGES.map((_, i) => String(i + 1).padStart(2, "0")));
  });

  for (const c of CHALLENGES) {
    it(`${c.number} "${c.title}" is made by its recorded solution`, () => {
      const layout = layoutById(c.layoutId);
      expect(c.solution.launch).toEqual(layout.launch);
      const res = runShot(R, { layout, aim: c.solution.aim, releaseTick: c.solution.releaseTick });
      const log = newShotLog();
      for (const e of res.events) logEvent(log, e);
      expect(res.scored).toBe(true);
      expect(challengeComplete(c.requirement, log)).toBe(true);
    });
  }
});

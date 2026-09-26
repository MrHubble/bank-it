import { describe, expect, it } from "vitest";
import { challengeComplete, matchSequence, requirementProgress, type Requirement } from "../src/rules/challenges.ts";
import { play } from "./helpers.ts";

const all = (...objects: string[]): Requirement => ({ kind: "all", objects });
const seq = (...objects: string[]): Requirement => ({ kind: "sequence", objects });

describe("called shot requirements", () => {
  it("needs a basket to complete", () => {
    expect(challengeComplete(all("bin"), play("bin"))).toBe(false);
    expect(challengeComplete(all("bin"), play("bin > BASKET"))).toBe(true);
  });

  it("accepts 'all' requirements in any order", () => {
    expect(challengeComplete(all("trampoline", "roof"), play("roof > trampoline > BASKET"))).toBe(true);
    expect(challengeComplete(all("trampoline", "roof"), play("trampoline > bin > roof > BASKET"))).toBe(true);
    expect(challengeComplete(all("trampoline", "roof"), play("trampoline > BASKET"))).toBe(false);
  });

  it("matches sequences in order, allowing other impacts in between", () => {
    const r = seq("roof", "umbrella", "bin");
    expect(challengeComplete(r, play("roof > umbrella > bin > BASKET"))).toBe(true);
    expect(challengeComplete(r, play("roof > ground > umbrella > backboard > bin > BASKET"))).toBe(true);
    expect(challengeComplete(r, play("umbrella > roof > bin > BASKET"))).toBe(false);
    expect(challengeComplete(r, play("bin > umbrella > roof > BASKET"))).toBe(false);
  });

  it("uses the actual sequence of separate impacts, not the set of objects", () => {
    // The first roof visit comes before the bin, but a second, separate visit
    // after the bin satisfies BIN → ROOF.
    expect(challengeComplete(seq("bin", "roof"), play("roof > bin > roof > BASKET"))).toBe(true);
    expect(challengeComplete(seq("bin", "roof"), play("roof > bin > BASKET"))).toBe(false);
    expect(matchSequence(["a", "b", "a"], ["a", "c", "b", "a"])).toBe(3);
    expect(matchSequence(["a", "b", "a"], ["a", "b", "b"])).toBe(2);
  });

  it("merges back-to-back impacts on one object into one visit", () => {
    expect(play("roof > roof > bin > bin").sequence).toEqual(["roof", "bin"]);
  });

  it("reports live progress with the next object to hit", () => {
    const p = requirementProgress(seq("roof", "umbrella", "bin"), play("roof > bin"));
    expect(p.items.map((i) => [i.objectId, i.met, i.next])).toEqual([
      ["roof", true, false],
      ["umbrella", false, true],
      ["bin", false, false],
    ]);
    expect(p.objectsMet).toBe(false);
  });

  it("requires a swish to touch nothing, not even the rim", () => {
    const r: Requirement = { kind: "swish" };
    expect(challengeComplete(r, play("BASKET"))).toBe(true);
    expect(challengeComplete(r, play("rim > BASKET"))).toBe(false);
    expect(challengeComplete(r, play("ground > BASKET"))).toBe(false);
  });
});

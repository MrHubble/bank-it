import type { Requirement } from "../rules/challenges.ts";
import type { Aim } from "../sim/types.ts";

// Called Shots: authored trick-shot challenges, easiest first. Every
// challenge carries a verified solution (aim and release tick) that
// tests/solutions.test.ts replays through the real simulation, so each one
// is known to be possible. Release tick is the number of 1/120 s ticks after
// the attempt starts (the ball appears in the kid's hands) that the shot is
// released; it only matters when the seagull is flying.

export interface ChallengeDef {
  id: string;
  number: string;
  layoutId: string;
  title: string;
  requirement: Requirement;
  hint: string;
  solution: { aim: Aim; releaseTick: number };
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "straight-in",
    number: "01",
    layoutId: "bin-there",
    title: "Nothing but net",
    requirement: { kind: "swish" },
    hint: "Warm up: straight in, touching nothing.",
    solution: { aim: { angleTenths: 450, powerTenths: 700 }, releaseTick: 0 },
  },
  {
    id: "off-the-bin",
    number: "02",
    layoutId: "bin-there",
    title: "Off the bin",
    requirement: { kind: "all", objects: ["bin"] },
    hint: "Drop it on the bin lid. It kicks the ball on towards the hoop.",
    solution: { aim: { angleTenths: 695, powerTenths: 595 }, releaseTick: 0 },
  },
];

export function challengeById(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

import type { Requirement } from "../rules/challenges.ts";
import type { Aim, Vec2 } from "../sim/types.ts";

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
  /** A verified solution: launch point, aim and release timing. */
  solution: { launch: Vec2; aim: Aim; releaseTick: number };
}

export const CHALLENGES: ChallengeDef[] = [
  // 01 Bin There: one object, then two in any order, then an order.
  {
    id: "straight-in",
    number: "01",
    layoutId: "bin-there",
    title: "Nothing but net",
    requirement: { kind: "swish" },
    hint: "Warm up: straight in, touching nothing. Not even the rim.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 614, powerTenths: 729 }, releaseTick: 0 },
  },
  {
    id: "off-the-bin",
    number: "02",
    layoutId: "bin-there",
    title: "Off the bin",
    requirement: { kind: "all", objects: ["bin"] },
    hint: "Drop it on the bin lid. The lid kicks it on towards the hoop.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 710, powerTenths: 636 }, releaseTick: 0 },
  },
  {
    id: "glass-work",
    number: "03",
    layoutId: "bin-there",
    title: "Glass work",
    requirement: { kind: "all", objects: ["backboard"] },
    hint: "Hit the board just above the rim and let it drop.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 434, powerTenths: 745 }, releaseTick: 0 },
  },
  {
    id: "up-on-the-roof",
    number: "04",
    layoutId: "bin-there",
    title: "Up on the roof",
    requirement: { kind: "all", objects: ["roof"] },
    hint: "Go over the hoop and let the roof send it back down.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 565, powerTenths: 782 }, releaseTick: 0 },
  },
  {
    id: "bin-and-board",
    number: "05",
    layoutId: "bin-there",
    title: "Bin and board",
    requirement: { kind: "all", objects: ["bin", "backboard"] },
    hint: "The bin and the board, in any order.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 714, powerTenths: 644 }, releaseTick: 0 },
  },
  {
    id: "bin-then-roof",
    number: "06",
    layoutId: "bin-there",
    title: "Bin, then roof",
    requirement: { kind: "sequence", objects: ["bin", "roof"] },
    hint: "Bin first, then up onto the roof. Order matters now.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 737, powerTenths: 696 }, releaseTick: 0 },
  },
  // 02 Air Mail
  {
    id: "boing",
    number: "07",
    layoutId: "air-mail",
    title: "Boing",
    requirement: { kind: "all", objects: ["trampoline"] },
    hint: "A low, soft shot onto the trampoline. It does the rest.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 144, powerTenths: 347 }, releaseTick: 0 },
  },
  {
    id: "brolly-bounce",
    number: "08",
    layoutId: "air-mail",
    title: "Brolly bounce",
    requirement: { kind: "all", objects: ["umbrella"] },
    hint: "Flat and fast into the umbrella. It folds after one bounce.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 199, powerTenths: 749 }, releaseTick: 0 },
  },
  {
    id: "trampoline-roof",
    number: "09",
    layoutId: "air-mail",
    title: "Trampoline + roof",
    requirement: { kind: "all", objects: ["trampoline", "roof"] },
    hint: "Trampoline and roof, in any order. Big air.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 239, powerTenths: 359 }, releaseTick: 0 },
  },
  {
    id: "return-to-sender",
    number: "10",
    layoutId: "air-mail",
    title: "Return to sender",
    requirement: { kind: "sequence", objects: ["roof", "umbrella", "backboard"] },
    hint: "Onto the roof, back across to the umbrella, off the board and in.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 464, powerTenths: 775 }, releaseTick: 0 },
  },
  // 03 Flight Risk: the seagull. Release timing matters here.
  {
    id: "bird-strike",
    number: "11",
    layoutId: "flight-risk",
    title: "Bird strike",
    requirement: { kind: "all", objects: ["gull"] },
    hint: "Time your release so the seagull gets in the way. The dotted line stops at it when you will hit it.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 679, powerTenths: 314 }, releaseTick: 456 },
  },
  {
    id: "gull-and-bin",
    number: "12",
    layoutId: "flight-risk",
    title: "Gull and bin",
    requirement: { kind: "all", objects: ["gull", "bin"] },
    hint: "The seagull and the bin, in any order.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 764, powerTenths: 588 }, releaseTick: 385 },
  },
  {
    id: "roof-then-gull",
    number: "13",
    layoutId: "flight-risk",
    title: "Roof, then gull",
    requirement: { kind: "sequence", objects: ["roof", "gull"] },
    hint: "Up onto the roof first, then clip the seagull on the way back down.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 581, powerTenths: 970 }, releaseTick: 421 },
  },
  {
    id: "the-scenic-route",
    number: "14",
    layoutId: "flight-risk",
    title: "The scenic route",
    requirement: { kind: "sequence", objects: ["roof", "bin", "gull", "backboard"] },
    hint: "Over the hoop onto the roof, back down onto the bin, up into the seagull, off the board. In that order.",
    solution: { launch: { x: 3, y: 1.5 }, aim: { angleTenths: 658, powerTenths: 845 }, releaseTick: 326 },
  },
];

export function challengeById(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

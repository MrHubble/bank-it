import type { ShotLog } from "./shotLog.ts";

// Called Shot requirements.
//
//  - "all": every listed object before the basket, in any order.
//  - "sequence": the listed objects in this order. Matching runs over the
//    actual sequence of separate impacts, so other objects may come in
//    between, but ROOF → BIN is not satisfied by BIN → ROOF.
//  - "swish": straight in, touching nothing at all on the way.

export type Requirement =
  | { kind: "all"; objects: string[] }
  | { kind: "sequence"; objects: string[] }
  | { kind: "swish" };

export interface RequirementItem {
  objectId: string;
  met: boolean;
  /** For sequences: the next object the shot still needs. */
  next: boolean;
}

export interface RequirementProgress {
  items: RequirementItem[];
  /** All object requirements met (the basket is still needed to complete). */
  objectsMet: boolean;
  /** For swish: false as soon as the ball touches anything. */
  clean: boolean;
}

/** Greedy left-to-right match; returns how many required objects are matched in order. */
export function matchSequence(required: string[], actual: string[]): number {
  let i = 0;
  for (const id of actual) {
    if (i < required.length && id === required[i]) i += 1;
  }
  return i;
}

export function requirementProgress(req: Requirement, log: ShotLog): RequirementProgress {
  if (req.kind === "swish") {
    const clean = log.impacts.length === 0;
    return { items: [], objectsMet: true, clean };
  }
  if (req.kind === "all") {
    const items = req.objects.map((objectId) => ({ objectId, met: log.distinct.includes(objectId), next: false }));
    return { items, objectsMet: items.every((i) => i.met), clean: true };
  }
  const matched = matchSequence(req.objects, log.sequence);
  const items = req.objects.map((objectId, i) => ({ objectId, met: i < matched, next: i === matched }));
  return { items, objectsMet: matched === req.objects.length, clean: true };
}

/** A Called Shot is made when the ball goes in with every requirement met. */
export function challengeComplete(req: Requirement, log: ShotLog): boolean {
  if (!log.scored) return false;
  const p = requirementProgress(req, log);
  return p.objectsMet && p.clean;
}

export function describeRequirement(req: Requirement, label: (id: string) => string): string {
  if (req.kind === "swish") return "Nothing but net";
  const names = req.objects.map((o) => label(o).toUpperCase());
  return req.kind === "all" ? `${names.join(" + ")} + BASKET` : `${names.join(" → ")} → BASKET`;
}

import { binSim } from "./bin.ts";
import { birdSim } from "./bird.ts";
import type { PropDef } from "./defs.ts";
import { garageSim } from "./garage.ts";
import { hoopSim } from "./hoop.ts";
import type { PropSimFactory } from "./propSim.ts";
import { roofSim } from "./roof.ts";
import { trampolineSim } from "./trampoline.ts";
import { umbrellaSim } from "./umbrella.ts";

// Add a new prop type (washing line, gnome, skateboard…) by writing its
// definition in defs.ts, a simulation factory here, and a view in
// src/render/props/. The game loop never needs to change.
export const propSims: { [K in PropDef["type"]]: PropSimFactory<Extract<PropDef, { type: K }>> } = {
  hoop: hoopSim,
  garage: garageSim,
  roof: roofSim,
  bin: binSim,
  trampoline: trampolineSim,
  umbrella: umbrellaSim,
  bird: birdSim,
};

export function propSimFor(def: PropDef): PropSimFactory<PropDef> {
  return propSims[def.type] as PropSimFactory<PropDef>;
}

import type { LayoutDef, PropDef } from "../../props/defs.ts";
import { binView } from "./binView.ts";
import { birdView } from "./birdView.ts";
import { garageView } from "./garageView.ts";
import { hoopView } from "./hoopView.ts";
import { roofView } from "./roofView.ts";
import { trampolineView } from "./trampolineView.ts";
import type { PropView, PropViewFactory } from "./types.ts";
import { umbrellaView } from "./umbrellaView.ts";

// Render-side registry, parallel to src/props/registry.ts.
const views: { [K in PropDef["type"]]: PropViewFactory<Extract<PropDef, { type: K }>> } = {
  hoop: hoopView,
  garage: garageView,
  roof: roofView,
  bin: binView,
  trampoline: trampolineView,
  umbrella: umbrellaView,
  bird: birdView,
};

export function createPropView(def: PropDef, layout: LayoutDef): PropView {
  return (views[def.type] as PropViewFactory<PropDef>).create(def, layout);
}

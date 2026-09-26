import type { LayoutDef } from "../src/props/defs.ts";

/**
 * Apply a JSON patch to a layout for quick experiments:
 *   {"launch":{"x":3}, "bin":{"x":10.8,"lidTilt":10}}
 * Keys other than launch/defaultAim are prop ids.
 */
export function applyPatch(layout: LayoutDef, patch?: string): LayoutDef {
  if (!patch) return layout;
  const p = JSON.parse(patch) as Record<string, Record<string, unknown>>;
  const out: LayoutDef = structuredClone(layout);
  for (const [k, v] of Object.entries(p)) {
    if (k === "launch" || k === "defaultAim") Object.assign(out[k], v);
    else {
      const prop = out.props.find((d) => d.id === k);
      if (!prop) throw new Error(`No prop ${k}`);
      Object.assign(prop, v);
    }
  }
  return out;
}

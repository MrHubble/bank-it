import type * as THREE from "three";
import type { LayoutDef, PropDef } from "../../props/defs.ts";
import type { SimEvent } from "../../sim/types.ts";
import type { Effects } from "../effects.ts";

export interface ViewFrame {
  /** Seconds since the last frame. */
  dt: number;
  /** Seconds since the page started (for idle loops). */
  time: number;
  /** Fractional phase tick for moving props (see BirdPath). */
  phase: number;
  /** Render-friendly state from the running shot, if any. */
  state: Record<string, number | boolean> | undefined;
  reducedMotion: boolean;
}

/** The visual side of a prop. Purely cosmetic: it never touches physics. */
export interface PropView {
  readonly def: PropDef;
  readonly object: THREE.Object3D;
  onEvent?(e: SimEvent, fx: Effects): void;
  update?(f: ViewFrame): void;
  /** Back to the start-of-attempt look (umbrella open, bird on patrol…). */
  reset?(): void;
  /** World position to anchor captions for this prop. */
  anchor?(): { x: number; y: number };
}

export interface PropViewFactory<D extends PropDef = PropDef> {
  create(def: D, layout: LayoutDef): PropView;
}

/** Critically damped-ish spring used for wobbles and jiggles. */
export class Spring {
  value = 0;
  velocity = 0;
  stiffness: number;
  damping: number;
  constructor(stiffness = 180, damping = 9) {
    this.stiffness = stiffness;
    this.damping = damping;
  }
  kick(v: number): void {
    this.velocity += v;
  }
  step(dt: number, target = 0): number {
    const h = Math.min(dt, 1 / 30);
    const a = -this.stiffness * (this.value - target) - this.damping * this.velocity;
    this.velocity += a * h;
    this.value += this.velocity * h;
    return this.value;
  }
  reset(): void {
    this.value = 0;
    this.velocity = 0;
  }
}

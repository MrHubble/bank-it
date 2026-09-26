import { clampAim } from "../sim/launch.ts";
import type { Aim } from "../sim/types.ts";

export interface AimHandlers {
  /** True while a new shot can be aimed. */
  canAim(): boolean;
  getAim(): Aim;
  /** Live aim while dragging or nudging. `dragging` false means committed. */
  setAim(aim: Aim, dragging: boolean): void;
  dragState(state: "start" | "cancel-zone" | "pulling" | "end"): void;
  shoot(): void;
  /** Space/Enter while a shot is finishing: skip ahead. */
  advance(): void;
  retry(): void;
  toggleGhost(): void;
  toggleMute(): void;
  escape(): void;
  help(): void;
  /** Any user gesture: used to start audio. */
  gesture(): void;
}

const DEAD_ZONE = 14;

/**
 * Drag back from the ball (or anywhere on the play area) to aim: direction is
 * opposite the drag, strength grows with distance. Pointer capture keeps the
 * drag alive outside the canvas; releasing inside the small dead zone, a
 * pointercancel, or Escape cancels it and restores the previous aim.
 * Keyboard: arrows or WASD to nudge (Shift for fine), Space/Enter to shoot,
 * R to retry, G ghost, M mute.
 */
export class AimInput {
  private readonly el: HTMLElement;
  private readonly h: AimHandlers;
  private readonly maxPull: () => number;
  private pointerId: number | null = null;
  private start = { x: 0, y: 0 };
  private before: Aim | null = null;
  private pulled = false;
  private readonly ac = new AbortController();

  constructor(el: HTMLElement, handlers: AimHandlers, maxPull: () => number) {
    this.el = el;
    this.h = handlers;
    this.maxPull = maxPull;
    const opts = { signal: this.ac.signal };
    el.addEventListener("pointerdown", this.onDown, opts);
    el.addEventListener("pointermove", this.onMove, opts);
    el.addEventListener("pointerup", this.onUp, opts);
    el.addEventListener("pointercancel", this.onCancel, opts);
    el.addEventListener("lostpointercapture", this.onLost, opts);
    el.addEventListener("contextmenu", (e) => e.preventDefault(), opts);
    window.addEventListener("keydown", this.onKey, opts);
    window.addEventListener("blur", () => this.cancel(), opts);
  }

  get dragging(): boolean {
    return this.pointerId !== null;
  }

  dispose(): void {
    this.cancel();
    this.ac.abort();
  }

  private onDown = (e: PointerEvent): void => {
    this.h.gesture();
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (this.pointerId !== null || !this.h.canAim()) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.start = { x: e.clientX, y: e.clientY };
    this.before = this.h.getAim();
    this.pulled = false;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone; the drag still works.
    }
    this.h.dragState("start");
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const wx = this.start.x - e.clientX;
    const wy = e.clientY - this.start.y;
    const dist = Math.hypot(wx, wy);
    if (dist < DEAD_ZONE) {
      this.pulled = false;
      if (this.before) this.h.setAim(this.before, true);
      this.h.dragState("cancel-zone");
      return;
    }
    this.pulled = true;
    let deg = (Math.atan2(wy, wx) * 180) / Math.PI;
    if (deg < 0) deg = deg < -90 ? 180 : 0;
    const power = Math.min(1, (dist - DEAD_ZONE) / Math.max(40, this.maxPull() - DEAD_ZONE));
    this.h.setAim(clampAim({ angleTenths: Math.round(deg * 10), powerTenths: Math.round(power * 1000) }), true);
    this.h.dragState("pulling");
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const shoot = this.pulled;
    this.release();
    if (shoot) {
      this.h.setAim(this.h.getAim(), false);
      this.h.dragState("end");
      this.h.shoot();
    } else {
      this.restore();
    }
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.cancel();
  };

  private onLost = (e: PointerEvent): void => {
    // Losing capture without a pointerup (e.g. the browser took the gesture).
    if (e.pointerId === this.pointerId) this.cancel();
  };

  /** Abandon any drag in progress and put the previous aim back. */
  cancel(): void {
    if (this.pointerId === null) return;
    this.release();
    this.restore();
  }

  private release(): void {
    const id = this.pointerId;
    this.pointerId = null;
    if (id !== null && this.el.hasPointerCapture?.(id)) {
      try {
        this.el.releasePointerCapture(id);
      } catch {
        // Already released.
      }
    }
  }

  private restore(): void {
    if (this.before) this.h.setAim(this.before, false);
    this.before = null;
    this.h.dragState("end");
  }

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    const onControl = !!target?.closest?.("button, input, select, textarea, a");
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "Escape") {
      if (this.dragging) this.cancel();
      else this.h.escape();
      return;
    }
    this.h.gesture();
    const fine = e.shiftKey;
    const angleStep = fine ? 1 : 5;
    const powerStep = fine ? 1 : 5;
    const nudge = (da: number, dp: number) => {
      if (!this.h.canAim() || this.dragging) return;
      e.preventDefault();
      const a = this.h.getAim();
      this.h.setAim(clampAim({ angleTenths: a.angleTenths + da, powerTenths: a.powerTenths + dp }), false);
    };
    switch (k) {
      case "ArrowLeft":
      case "a":
      case "A":
        nudge(angleStep, 0);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        nudge(-angleStep, 0);
        break;
      case "ArrowUp":
      case "w":
      case "W":
        nudge(0, powerStep);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        nudge(0, -powerStep);
        break;
      case " ":
      case "Enter":
        if (onControl) return;
        e.preventDefault();
        if (e.repeat) return;
        if (this.h.canAim()) this.h.shoot();
        else this.h.advance();
        break;
      case "r":
      case "R":
        if (e.repeat) return;
        this.cancel();
        this.h.retry();
        break;
      case "g":
      case "G":
        this.h.toggleGhost();
        break;
      case "m":
      case "M":
        this.h.toggleMute();
        break;
      case "?":
      case "h":
      case "H":
        this.h.help();
        break;
    }
  };
}

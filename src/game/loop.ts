import { DT } from "../sim/constants.ts";

/**
 * Fixed-timestep loop. Simulation ticks run at exactly 120 Hz whatever the
 * display refresh rate; rendering interpolates between ticks. The loop stops
 * while the tab is hidden and restarts without a catch-up burst.
 */
export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private readonly tick: () => void;
  private readonly frame: (alpha: number, dt: number) => void;

  constructor(tick: () => void, frame: (alpha: number, dt: number) => void) {
    this.tick = tick;
    this.frame = frame;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onFrame = (now: number): void => {
    if (!this.running) return;
    // Clamp long frames (a stall or a background tab) so physics never jumps.
    const delta = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.acc += delta;
    let steps = 0;
    while (this.acc >= DT && steps < 12) {
      this.tick();
      this.acc -= DT;
      steps++;
    }
    if (steps === 12) this.acc = 0;
    this.frame(this.acc / DT, delta);
    this.raf = requestAnimationFrame(this.onFrame);
  };
}

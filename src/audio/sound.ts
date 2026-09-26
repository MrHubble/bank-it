// Procedural sound effects with the Web Audio API. Nothing is downloaded and
// no external service is used. The AudioContext is only created after the
// first user interaction, as browsers require.

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;
  private lastPlayed = new Map<string, number>();

  constructor(muted: boolean) {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Call from a user gesture (pointerdown/keydown). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.75;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 7;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.75, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private ready(key: string, minGap = 0.04): AudioContext | null {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== "running") return null;
    const last = this.lastPlayed.get(key) ?? -1;
    if (ctx.currentTime - last < minGap) return null;
    this.lastPlayed.set(key, ctx.currentTime);
    return ctx;
  }

  private env(ctx: AudioContext, peak: number, attack: number, decay: number, at = ctx.currentTime): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(this.master!);
    return g;
  }

  private tone(ctx: AudioContext, type: Wave, f0: number, f1: number, peak: number, attack: number, decay: number, at = ctx.currentTime, dest?: AudioNode): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + attack + decay);
    const g = this.env(ctx, peak, attack, decay, at);
    o.connect(dest ?? g);
    if (dest) dest.connect(g);
    o.start(at);
    o.stop(at + attack + decay + 0.05);
    return o;
  }

  private burst(ctx: AudioContext, filter: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, at = ctx.currentTime, freqEnd?: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, at);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, at + attack + decay);
    f.Q.value = q;
    const g = this.env(ctx, peak, attack, decay, at);
    src.connect(f);
    f.connect(g);
    src.start(at, (at * 0.37) % 0.5);
    src.stop(at + attack + decay + 0.05);
  }

  /** Ball on the driveway. */
  bounce(speed: number): void {
    const ctx = this.ready("bounce", 0.05);
    if (!ctx || speed < 0.6) return;
    const v = Math.min(1, speed / 12);
    this.tone(ctx, "sine", 150, 55, 0.5 * v + 0.05, 0.004, 0.16);
    this.burst(ctx, "lowpass", 900, 0.7, 0.2 * v, 0.002, 0.05);
  }

  rim(speed: number): void {
    const ctx = this.ready("rim", 0.05);
    if (!ctx) return;
    const v = Math.min(1, 0.25 + speed / 10);
    for (const [f, a] of [
      [560, 0.22],
      [1370, 0.12],
      [2210, 0.06],
    ]) this.tone(ctx, "sine", f, f * 0.995, a * v, 0.002, 0.45);
    this.burst(ctx, "highpass", 3000, 0.5, 0.08 * v, 0.001, 0.04);
  }

  board(speed: number): void {
    const ctx = this.ready("board", 0.06);
    if (!ctx) return;
    const v = Math.min(1, 0.3 + speed / 12);
    this.tone(ctx, "triangle", 210, 140, 0.35 * v, 0.003, 0.14);
    this.burst(ctx, "bandpass", 700, 1.2, 0.25 * v, 0.002, 0.08);
  }

  wall(speed: number): void {
    const ctx = this.ready("wall", 0.06);
    if (!ctx) return;
    const v = Math.min(1, 0.3 + speed / 12);
    // Rattly roller door.
    this.burst(ctx, "bandpass", 420, 2, 0.35 * v, 0.002, 0.2);
    this.tone(ctx, "square", 95, 80, 0.06 * v, 0.003, 0.18);
  }

  swish(): void {
    const ctx = this.ready("swish", 0.2);
    if (!ctx) return;
    this.burst(ctx, "bandpass", 1800, 1.4, 0.45, 0.04, 0.32, ctx.currentTime, 6500);
  }

  /** Wheelie bin: hollow plastic clang with a wobble. */
  clang(speed: number): void {
    const ctx = this.ready("clang", 0.06);
    if (!ctx) return;
    const v = Math.min(1, 0.3 + speed / 10);
    const t = ctx.currentTime;
    this.burst(ctx, "bandpass", 820, 3, 0.4 * v, 0.002, 0.18);
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 17;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + 0.5);
    this.tone(ctx, "triangle", 310, 285, 0.3 * v, 0.003, 0.4, t, trem);
    this.tone(ctx, "sine", 465, 440, 0.12 * v, 0.003, 0.3);
  }

  /** Trampoline. */
  boing(strength = 1): void {
    const ctx = this.ready("boing", 0.08);
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(440 * (0.85 + strength * 0.2), t + 0.12);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const vib = ctx.createOscillator();
    vib.frequency.value = 22;
    const vg = ctx.createGain();
    vg.gain.value = 26;
    vib.connect(vg);
    vg.connect(o.frequency);
    const g = this.env(ctx, 0.45, 0.01, 0.55, t);
    o.connect(g);
    o.start(t);
    vib.start(t);
    o.stop(t + 0.6);
    vib.stop(t + 0.6);
  }

  /** Seagull. */
  squawk(): void {
    const ctx = this.ready("squawk", 0.2);
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [dt, f] of [
      [0, 820],
      [0.13, 980],
      [0.28, 760],
    ]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.7, t + dt);
      o.frequency.exponentialRampToValueAtTime(f, t + dt + 0.03);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dt + 0.12);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      bp.Q.value = 1.5;
      const g = this.env(ctx, 0.3, 0.01, 0.12, t + dt);
      o.connect(bp);
      bp.connect(g);
      o.start(t + dt);
      o.stop(t + dt + 0.16);
    }
  }

  /** Roof tiles rattling. */
  rattle(speed: number): void {
    const ctx = this.ready("rattle", 0.08);
    if (!ctx) return;
    const v = Math.min(1, 0.35 + speed / 10);
    const t = ctx.currentTime;
    const hits = 5 + Math.round(v * 4);
    for (let i = 0; i < hits; i++) {
      const at = t + i * 0.035 + ((i * 7) % 3) * 0.008;
      this.burst(ctx, "bandpass", 2400 + ((i * 331) % 900), 4, 0.22 * v * (1 - i / hits), 0.001, 0.03, at);
    }
    this.tone(ctx, "sine", 180, 120, 0.2 * v, 0.003, 0.1);
  }

  /** Umbrella folding: a whoomp and a slide whistle down. */
  fold(): void {
    const ctx = this.ready("fold", 0.2);
    if (!ctx) return;
    this.burst(ctx, "lowpass", 600, 0.8, 0.4, 0.01, 0.2);
    this.tone(ctx, "sine", 1100, 260, 0.2, 0.02, 0.45);
  }

  canopy(speed: number): void {
    const ctx = this.ready("canopy", 0.06);
    if (!ctx) return;
    const v = Math.min(1, 0.3 + speed / 10);
    this.burst(ctx, "lowpass", 380, 1.5, 0.4 * v, 0.003, 0.12);
    this.tone(ctx, "sine", 120, 90, 0.25 * v, 0.003, 0.12);
  }

  launch(power: number): void {
    const ctx = this.ready("launch", 0.1);
    if (!ctx) return;
    this.burst(ctx, "bandpass", 500, 0.9, 0.12 + power * 0.18, 0.02, 0.22, ctx.currentTime, 1600);
  }

  /** A pluck that climbs with every new object in the chain. */
  chain(n: number): void {
    const ctx = this.ready("chain", 0.03);
    if (!ctx) return;
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const f = scale[Math.min(scale.length - 1, n - 1)];
    this.tone(ctx, "triangle", f, f, 0.18, 0.004, 0.22);
    this.tone(ctx, "sine", f * 2, f * 2, 0.06, 0.004, 0.15);
  }

  /** Basket jingle; longer chains get longer, brighter fanfares. */
  cheer(level: number): void {
    const ctx = this.ready("cheer", 0.3);
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
    const count = Math.min(notes.length, 3 + level);
    for (let i = 0; i < count; i++) {
      this.tone(ctx, "square", notes[i], notes[i], 0.07, 0.005, 0.16, t + i * 0.07);
      this.tone(ctx, "triangle", notes[i], notes[i], 0.14, 0.005, 0.22, t + i * 0.07);
    }
    const end = t + count * 0.07;
    if (level >= 2) for (const f of [notes[0], notes[2], notes[4]]) this.tone(ctx, "triangle", f, f, 0.1, 0.01, 0.6, end);
    if (level >= 4) this.burst(ctx, "highpass", 5000, 0.5, 0.12, 0.05, 0.8, end);
  }

  groan(): void {
    const ctx = this.ready("groan", 0.3);
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, "triangle", 330, 300, 0.18, 0.01, 0.22, t);
    this.tone(ctx, "triangle", 262, 196, 0.18, 0.01, 0.45, t + 0.24);
  }

  ooh(): void {
    const ctx = this.ready("ooh", 0.3);
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(330, t + 0.25);
    o.frequency.linearRampToValueAtTime(180, t + 0.75);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = this.env(ctx, 0.2, 0.08, 0.7, t);
    o.connect(lp);
    lp.connect(g);
    o.start(t);
    o.stop(t + 0.85);
  }

  ding(): void {
    const ctx = this.ready("ding", 0.05);
    if (!ctx) return;
    this.tone(ctx, "sine", 1318.5, 1318.5, 0.2, 0.003, 0.35);
    this.tone(ctx, "sine", 1975.5, 1975.5, 0.08, 0.003, 0.25);
  }

  click(): void {
    const ctx = this.ready("click", 0.03);
    if (!ctx) return;
    this.tone(ctx, "square", 880, 660, 0.05, 0.001, 0.04);
  }
}

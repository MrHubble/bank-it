import * as THREE from "three";
import { Sound } from "../audio/sound.ts";
import { AimInput } from "../input/aimInput.ts";
import { CHALLENGES, type ChallengeDef, challengeById } from "../levels/challenges.ts";
import { LAYOUTS, layoutById } from "../levels/layouts.ts";
import { type LayoutDef, hoopCentre, hoopOf } from "../props/defs.ts";
import { challengeComplete, requirementProgress } from "../rules/challenges.ts";
import { scoreChain } from "../rules/scoring.ts";
import { logEvent, newShotLog, type ShotLog } from "../rules/shotLog.ts";
import { DT, SPEED_MAX, TICK_RATE, VIEW_RECT } from "../sim/constants.ts";
import { launchSpeed, launchVelocity } from "../sim/launch.ts";
import { PreviewProbe } from "../sim/preview.ts";
import type { Rapier } from "../sim/rapier.ts";
import { ShotSim } from "../sim/shot.ts";
import type { Aim, EndReason, ImpactEvent, SimEvent, Vec2 } from "../sim/types.ts";
import { AimView } from "../render/aim.ts";
import { BallView } from "../render/ball.ts";
import { Effects, type CaptionTone } from "../render/effects.ts";
import { Kid } from "../render/kid.ts";
import { createPropView } from "../render/props/index.ts";
import type { PropView } from "../render/props/types.ts";
import { Scenery } from "../render/scenery.ts";
import { Stage } from "../render/stage.ts";
import { Hud } from "../ui/hud.ts";
import { Overlay, type OverlayModel, type Screen } from "../ui/overlay.ts";
import { FixedLoop } from "./loop.ts";
import { type BestRound, keys, load, save } from "./storage.ts";

export const SHOTS_PER_ROUND = 10;

type Mode =
  | {
      kind: "freestyle";
      layout: LayoutDef;
      shotsLeft: number;
      score: number;
      baskets: number;
      bestShot: number;
      bestChain: string[] | null;
      bestChainScore: number;
    }
  | { kind: "challenge"; def: ChallengeDef; layout: LayoutDef; attempts: number; done: boolean };

type Phase = "idle" | "ready" | "flying" | "resolving";

const MISS_LINES: Record<EndReason, string[]> = {
  out: ["OVER THE FENCE!", "NEXT DOOR'S NOW", "TOO SCENIC", "WRONG POSTCODE"],
  settled: ["SO THAT HAPPENED", "NOPE", "BRICKED IT"],
  rolled: ["BRICK!", "AIRBALL-ISH", "NOT EVEN CLOSE", "MAYBE LESS POWER?"],
  timeout: ["TAKING ITS TIME…"],
};

/**
 * The game controller. It owns the fixed-step loop and wires the pieces
 * together: the simulation (src/sim) produces events; the rules (src/rules)
 * turn them into chains and scores; the views (src/render) react; the HUD
 * and overlays (src/ui) show the result; the sound engine plays along.
 */
export class Game {
  private readonly R: Rapier;
  private readonly stage: Stage;
  private readonly scenery = new Scenery();
  private readonly propGroup = new THREE.Group();
  private propViews: PropView[] = [];
  private kid: Kid;
  private readonly ball = new BallView();
  private readonly aimView = new AimView();
  private readonly fx: Effects;
  private readonly sound: Sound;
  private readonly hud: Hud;
  private readonly overlay: Overlay;
  private readonly input: AimInput;
  private readonly loop: FixedLoop;
  private readonly ac = new AbortController();

  private layout: LayoutDef;
  private probe: PreviewProbe;
  private mode: Mode | null = null;
  private phase: Phase = "idle";
  private aim: Aim;
  private dragging = false;
  private phaseTick = 0;
  private shot: ShotSim | null = null;
  private halted = false;
  private log: ShotLog = newShotLog();
  private shotPath: Vec2[] = [];
  private ghostPath: Vec2[] | null = null;
  private ghostOn: boolean;
  private resolveTimer = 0;
  private prevBall: Vec2;
  private currBall: Vec2;
  private minHoopDist = Infinity;
  private birdHitAt = -1;
  private simTime = 0;
  private time = 0;
  private throwTimer = 0;
  private reducedMotion = false;
  private missCount = 0;
  private metCount = 0;

  constructor(R: Rapier) {
    this.R = R;
    this.stage = new Stage(document.getElementById("stage")!);
    this.fx = new Effects(this.stage.camera, document.getElementById("captions")!);
    this.layout = LAYOUTS[0];
    this.kid = new Kid(this.layout.launch);
    this.probe = new PreviewProbe(R, this.layout);
    this.aim = this.loadAim(this.layout);
    this.prevBall = { ...this.layout.launch };
    this.currBall = { ...this.layout.launch };
    this.sound = new Sound(load(keys.muted, false));
    this.ghostOn = load(keys.ghost, true);

    const scene = this.stage.scene;
    scene.add(this.scenery.object, this.propGroup, this.kid.object, this.ball.object, ...this.ball.extras, this.aimView.object, this.fx.group);

    this.hud = new Hud({
      nudge: (kind, fine) => this.nudge(kind, fine),
      shoot: () => this.shoot(),
      retry: () => this.retry(),
      toggleGhost: () => this.toggleGhost(),
      toggleMute: () => this.toggleMute(),
      menu: () => this.openPause(),
      gesture: () => this.sound.unlock(),
    });
    this.overlay = new Overlay(document.getElementById("overlay")!, (a, id) => this.onOverlayAction(a, id));
    this.input = new AimInput(
      this.stage.renderer.domElement,
      {
        canAim: () => this.phase === "ready" && !this.overlay.open,
        getAim: () => this.aim,
        setAim: (aim, dragging) => this.setAim(aim, dragging),
        dragState: (s) => this.onDragState(s),
        shoot: () => this.shoot(),
        advance: () => this.advance(),
        retry: () => this.retry(),
        toggleGhost: () => this.toggleGhost(),
        toggleMute: () => this.toggleMute(),
        escape: () => this.onEscape(),
        help: () => this.showScreen("help", this.overlay.open ? this.overlay.screen : null),
        gesture: () => this.sound.unlock(),
      },
      () => Math.max(110, Math.min(260, Math.min(this.stage.width, this.stage.height) * 0.34)),
    );
    // Tap during a celebration or miss to skip straight to the next shot.
    this.stage.renderer.domElement.addEventListener(
      "pointerdown",
      () => {
        if (this.phase === "resolving" && this.resolveTimer < this.resolveLength - 0.35) this.advance();
      },
      { signal: this.ac.signal },
    );
    this.loop = new FixedLoop(
      () => this.tick(),
      (alpha, dt) => this.frame(alpha, dt),
    );

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      this.reducedMotion = mq.matches;
      this.fx.reducedMotion = mq.matches;
      document.documentElement.classList.toggle("reduced-motion", mq.matches);
    };
    applyMotion();
    mq.addEventListener("change", applyMotion, { signal: this.ac.signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.input.cancel();
          this.loop.stop();
          this.sound.suspend();
        } else {
          this.loop.start();
          this.sound.resume();
        }
      },
      { signal: this.ac.signal },
    );
    this.stage.onResize = () => this.fx.setViewport(this.stage.width, this.stage.height);
    const hudObserver = new ResizeObserver(() => this.measureInsets());
    for (const el of document.querySelectorAll(".hud-top, .hud-bottom")) hudObserver.observe(el);
    this.ac.signal.addEventListener("abort", () => hudObserver.disconnect());

    this.setLayout(this.layout);
    this.hud.setToggles(this.ghostOn, this.sound.isMuted);
    this.newAttempt();
    this.phase = "idle";
    this.hud.setVisible(false);
    this.measureInsets();
  }

  start(): void {
    this.showScreen("title");
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.ac.abort();
    this.input.dispose();
    this.hud.dispose();
    this.overlay.dispose();
    this.disposeShot();
    this.stage.dispose();
  }

  /** Test hook: everything needed to drive the game from a browser test. */
  debugApi() {
    return {
      state: () => ({
        phase: this.phase,
        overlay: this.overlay.screen,
        aim: { ...this.aim },
        phaseTick: this.phaseTick,
        mode: this.mode ? { ...this.mode, layout: this.mode.layout.id, def: undefined } : null,
        log: this.log,
        ball: { ...this.currBall },
        muted: this.sound.isMuted,
        ghost: this.ghostOn,
        pxPerMetre: this.stage.pxPerMetre,
        insets: this.insets,
      }),
      setAim: (a: Aim) => this.setAim(a, false),
      shoot: () => this.shoot(),
      retry: () => this.retry(),
      startFreestyle: (id: string) => this.startFreestyle(id),
      startChallenge: (id: string) => this.startChallenge(id),
      /** Screen position (CSS px, relative to the canvas) of a play-plane point. */
      toScreen: (x: number, y: number) => this.stage.camera.toScreen(x, y, this.stage.width, this.stage.height),
      launch: () => ({ ...this.layout.launch }),
    };
  }

  // ---------------------------------------------------------------- modes

  private startFreestyle(layoutId: string): void {
    const layout = layoutById(layoutId);
    this.setLayout(layout);
    this.mode = { kind: "freestyle", layout, shotsLeft: SHOTS_PER_ROUND, score: 0, baskets: 0, bestShot: 0, bestChain: null, bestChainScore: 0 };
    this.hud.setMode(`Freestyle · ${layout.number} ${layout.name}`);
    this.enterPlay();
  }

  private startChallenge(id: string): void {
    const def = challengeById(id) ?? CHALLENGES[0];
    const layout = layoutById(def.layoutId);
    this.setLayout(layout);
    this.mode = { kind: "challenge", def, layout, attempts: 0, done: false };
    this.hud.setMode(`Called shot ${def.number} · ${layout.name}`);
    this.enterPlay();
  }

  private enterPlay(): void {
    this.overlay.hide();
    this.hud.setVisible(true);
    this.ghostPath = null;
    this.fx.clear();
    this.newAttempt();
    this.measureInsets();
  }

  private setLayout(layout: LayoutDef): void {
    const same = layout === this.layout && this.propViews.length > 0;
    if (!same) {
      for (const v of this.propViews) {
        this.propGroup.remove(v.object);
        v.object.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      this.layout = layout;
      this.propViews = layout.props.map((d) => createPropView(d, layout));
      for (const v of this.propViews) this.propGroup.add(v.object);
      this.scenery.setDecor(layout.decor);
      this.stage.scene.remove(this.kid.object);
      this.kid = new Kid(layout.launch);
      this.stage.scene.add(this.kid.object);
      this.probe = new PreviewProbe(this.R, layout);
      this.aim = this.loadAim(layout);
      this.hud.setAim(this.aim);
    }
  }

  private loadAim(layout: LayoutDef): Aim {
    const a = load<Aim | null>(keys.aim(layout.id), null);
    return a && Number.isFinite(a.angleTenths) && Number.isFinite(a.powerTenths) ? a : { ...layout.defaultAim };
  }

  private label = (id: string): string => this.layout.props.find((p) => p.id === id)?.label ?? id;

  // ------------------------------------------------------------- attempts

  private newAttempt(): void {
    this.disposeShot();
    this.phase = "ready";
    this.phaseTick = 0;
    this.birdHitAt = -1;
    this.metCount = 0;
    for (const v of this.propViews) v.reset?.();
    this.ball.place(this.layout.launch);
    this.ball.setVisible(true);
    this.prevBall = { ...this.layout.launch };
    this.currBall = { ...this.layout.launch };
    this.log = newShotLog();
    this.kid.setPose("ready");
    this.hud.clearChain();
    this.hud.setCanShoot(true);
    this.hud.setAim(this.aim);
    this.aimView.setGhost(this.ghostPath);
    this.aimView.setGhostVisible(this.ghostOn);
    this.updateStatus();
    this.hud.setHint(this.readyHint());
  }

  private readyHint(): string {
    if (this.mode?.kind === "challenge") return this.mode.def.hint;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    return touch ? "Drag back from the ball, then let go." : "Drag back from the ball and let go · or ← → ↑ ↓ and Space";
  }

  private shoot(): void {
    if (this.phase !== "ready" || this.overlay.open || !this.mode) return;
    this.sound.unlock();
    const aim = { ...this.aim };
    save(keys.aim(this.layout.id), aim);
    this.shot = new ShotSim(this.R, { layout: this.layout, aim, releaseTick: this.phaseTick });
    this.halted = false;
    this.log = newShotLog();
    this.shotPath = [{ ...this.layout.launch }];
    this.minHoopDist = Infinity;
    this.phase = "flying";
    if (this.mode.kind === "freestyle") this.mode.shotsLeft -= 1;
    else this.mode.attempts += 1;
    const v = launchVelocity(aim);
    this.ball.launch(v.x);
    this.kid.setPose("throw");
    this.throwTimer = 0.3;
    this.sound.launch(aim.powerTenths / 1000);
    this.aimView.hideAim();
    this.hud.setCanShoot(false);
    this.hud.setHint("Retry any time with ↻ or R.");
    this.updateStatus();
  }

  /** Abandon the current shot (it still used up its attempt) or restart the wait. */
  private retry(): void {
    if (this.overlay.open || !this.mode) return;
    this.sound.unlock();
    if (this.phase === "flying" || this.phase === "resolving") this.finishShot();
    else if (this.phase === "ready") this.newAttempt();
  }

  private advance(): void {
    if (this.phase === "resolving") this.finishShot();
  }

  private resolveLength = 1;
  private resolve(seconds: number): void {
    this.phase = "resolving";
    this.resolveTimer = seconds;
    this.resolveLength = seconds;
  }

  private finishShot(): void {
    if (this.shotPath.length > 1) this.ghostPath = this.shotPath;
    this.disposeShot();
    const m = this.mode;
    if (m?.kind === "freestyle" && m.shotsLeft <= 0) {
      this.endRound();
      return;
    }
    if (m?.kind === "challenge" && m.done) {
      this.phase = "idle";
      this.hud.setCanShoot(false);
      const prev = load<number | null>(keys.challenge(m.def.id), null);
      const best = prev === null ? m.attempts : Math.min(prev, m.attempts);
      save(keys.challenge(m.def.id), best);
      const idx = CHALLENGES.indexOf(m.def);
      this.showScreen("complete", null, {
        complete: { def: m.def, attempts: m.attempts, best, newBest: prev === null || m.attempts < prev, hasNext: idx < CHALLENGES.length - 1, label: this.label },
      });
      return;
    }
    this.newAttempt();
  }

  private endRound(): void {
    const m = this.mode;
    if (m?.kind !== "freestyle") return;
    this.phase = "idle";
    this.hud.setCanShoot(false);
    const prev = load<BestRound | null>(keys.best(m.layout.id), null);
    const newBest = m.score > 0 && (!prev || m.score > prev.score);
    if (newBest) save(keys.best(m.layout.id), { score: m.score, chain: m.bestChain ?? [], chainScore: m.bestChainScore } satisfies BestRound);
    this.showScreen("summary", null, {
      summary: {
        layout: m.layout,
        score: m.score,
        baskets: m.baskets,
        shots: SHOTS_PER_ROUND,
        bestShot: m.bestShot,
        bestChain: m.bestChain,
        newBest,
        previousBest: prev?.score ?? 0,
      },
    });
    if (newBest) this.sound.cheer(3);
  }

  private disposeShot(): void {
    this.shot?.dispose();
    this.shot = null;
  }

  // ---------------------------------------------------------------- loop

  private tick(): void {
    this.simTime += DT;
    if (this.overlay.open) return;
    if (this.phase === "ready") {
      this.phaseTick += 1;
      return;
    }
    if (this.phase !== "flying" && this.phase !== "resolving") return;
    const shot = this.shot;
    if (shot && !this.halted) {
      this.prevBall = this.currBall;
      const events = shot.step();
      this.currBall = { ...shot.pos };
      if (this.shotPath.length < 1400) this.shotPath.push(this.currBall);
      const c = hoopCentre(shot.hoop);
      if (!shot.scored && shot.pos.y > shot.hoop.rimY - 0.4) {
        this.minHoopDist = Math.min(this.minHoopDist, Math.hypot(shot.pos.x - c.x, shot.pos.y - c.y));
      }
      for (const e of events) this.onSimEvent(e);
    }
    if (this.phase === "resolving") {
      this.resolveTimer -= DT;
      if (this.resolveTimer <= 0) this.finishShot();
    }
  }

  private frame(alpha: number, dt: number): void {
    this.time += dt;
    const shot = this.shot;
    const phase = this.phase === "ready" || !shot ? this.phaseTick + (this.overlay.open ? 0 : alpha) : shot.phaseTick + (this.halted ? 0 : alpha);
    const states = shot?.propStates();
    for (const v of this.propViews) {
      v.update?.({ dt, time: this.time, phase, state: states?.[v.def.id], reducedMotion: this.reducedMotion });
    }
    if (this.phase === "ready" || !shot) {
      this.ball.set(this.layout.launch, 0, 0, dt, false);
    } else {
      const a = this.halted ? 1 : alpha;
      const p = { x: this.prevBall.x + (this.currBall.x - this.prevBall.x) * a, y: this.prevBall.y + (this.currBall.y - this.prevBall.y) * a };
      this.ball.set(p, shot.angle, Math.hypot(shot.vel.x, shot.vel.y), dt, this.phase === "flying" || this.phase === "resolving");
    }
    if (this.throwTimer > 0) {
      this.throwTimer -= dt;
      if (this.throwTimer <= 0 && this.phase === "flying") this.kid.setPose("watch");
    }
    this.kid.update(dt, this.reducedMotion);

    if (this.phase === "ready" && !this.overlay.open && this.mode) {
      const preview = this.probe.predict(this.aim, this.phaseTick);
      this.aimView.showAim(this.layout.launch, (this.aim.angleTenths / 10) * (Math.PI / 180), this.aim.powerTenths / 1000, preview, this.dragging);
    } else {
      this.aimView.hideAim();
    }
    this.aimView.update(dt);
    if (this.phase === "flying" && !this.log.scored) {
      this.hud.setChain(this.log.distinct.map(this.label), "flying", this.log.distinct.length ? scoreChain(this.log) : null);
    }
    this.fx.update(dt);
    this.scenery.update(dt, this.reducedMotion);
    this.stage.render(this.fx.shakeOffset());
  }

  // --------------------------------------------------------------- events

  private onSimEvent(e: SimEvent): void {
    for (const v of this.propViews) v.onEvent?.(e, this.fx);
    switch (e.type) {
      case "impact":
        this.onImpact(e);
        break;
      case "boost":
        this.sound.boing(e.speed / 13);
        this.fx.caption("BOING!", { x: e.point.x, y: e.point.y + 0.9 }, "boing", "md");
        break;
      case "fold":
        this.sound.fold();
        this.fx.caption("FWUMP!", this.anchorOf(e.objectId), "brolly", "md");
        break;
      case "bird-hit":
        this.sound.squawk();
        this.birdHitAt = this.simTime;
        this.fx.caption("SQUAWK!", { x: e.point.x, y: e.point.y + 0.8 }, "bird", "lg");
        break;
      case "basket":
        this.onBasket(e.swish);
        break;
      case "end":
        this.onEnd(e.reason);
        break;
    }
  }

  private anchorOf(id: string): Vec2 {
    return this.propViews.find((v) => v.def.id === id)?.anchor?.() ?? { x: 8, y: 4 };
  }

  private onImpact(e: ImpactEvent): void {
    this.ball.impact(e.normal, e.speed);
    const s = e.speed;
    switch (e.kind) {
      case "ground":
        this.sound.bounce(s);
        if (s > 3) this.fx.burst("dust", { x: e.point.x, y: 0.04 }, { count: 4, speed: 0.9, dir: Math.PI / 2, spread: 2.6, colors: ["#efe4cf"], size: 0.09, life: 0.45, gravity: 0.4 });
        break;
      case "rim":
        this.sound.rim(s);
        break;
      case "backboard":
        this.sound.board(s);
        break;
      case "wall":
        this.sound.wall(s);
        break;
      case "roof":
        this.sound.rattle(s);
        break;
      case "bin":
        this.sound.clang(s);
        break;
      case "trampoline":
        if (e.part === "frame") this.sound.board(s * 0.6);
        break;
      case "umbrella":
        this.sound.canopy(s);
        break;
      case "pole":
        this.sound.rim(s * 0.6);
        break;
    }
    if (!this.shot || this.shot.scored) return;
    const isNew = logEvent(this.log, e);
    if (!isNew) return;
    const n = this.log.distinct.length;
    this.sound.chain(n);
    const words: Record<string, [string, CaptionTone]> = {
      roof: ["RATTLE!", "roof"],
      bin: ["CLANG!", "clang"],
      backboard: ["THWACK!", "board"],
      umbrella: ["BOOF!", "brolly"],
      trampoline: ["", "boing"],
      bird: ["", "bird"],
    };
    const w = words[e.kind];
    if (w && w[0]) this.fx.caption(w[0], { x: e.point.x, y: e.point.y + 0.7 }, w[1], n >= 3 ? "lg" : "md");
    if (this.mode?.kind === "challenge") {
      const p = requirementProgress(this.mode.def.requirement, this.log);
      const met = p.items.filter((i) => i.met).length;
      if (met > this.metCount) this.sound.ding();
      this.metCount = met;
      this.updateStatus();
    }
  }

  private onBasket(swish: boolean): void {
    const shot = this.shot;
    if (!shot) return;
    logEvent(this.log, { type: "basket", tick: shot.tick, swish, point: shot.pos });
    const score = scoreChain(this.log);
    const labels = this.log.distinct.map(this.label);
    const n = labels.length;
    const level = Math.min(4, n);
    const hoop = hoopOf(this.layout);
    const c = hoopCentre(hoop);
    this.hud.setChain(labels, "scored", score);
    this.sound.swish();
    this.kid.setPose("cheer");
    const m = this.mode;
    let calledIt = true;
    if (m?.kind === "freestyle") {
      m.score += score.total;
      m.baskets += 1;
      m.bestShot = Math.max(m.bestShot, score.total);
      const better = !m.bestChain || n > m.bestChain.length || (n === m.bestChain.length && score.total > m.bestChainScore);
      if (better) {
        m.bestChain = labels;
        m.bestChainScore = score.total;
      }
    } else if (m?.kind === "challenge") {
      calledIt = challengeComplete(m.def.requirement, this.log);
      if (calledIt) m.done = true;
    }
    this.updateStatus();

    // Escalating celebration.
    const words = ["BASKET!", "BANKED IT!", "COMBO!", "SCENIC ROUTE!", "LEGENDARY!"];
    const tones: CaptionTone[] = ["good", "good", "great", "great", "legend"];
    const top = { x: c.x - 0.6, y: hoop.boardTop + 0.9 };
    if (m?.kind === "challenge" && !calledIt) {
      this.fx.caption("NOT THE CALLED ROUTE", top, "near", "md");
      this.sound.cheer(0);
    } else {
      this.fx.caption(m?.kind === "challenge" ? "CALLED IT!" : words[level], top, tones[level], level >= 2 || m?.kind === "challenge" ? "lg" : "md");
      this.sound.cheer(level + (m?.kind === "challenge" ? 1 : 0));
    }
    if (swish && n === 0 && !this.log.groundBounce) this.fx.caption("NOTHING BUT NET", { x: c.x - 1.4, y: hoop.rimY - 0.9 }, "info", "sm");
    if (this.log.birdHit) this.fx.caption("BIRDIE!", { x: c.x - 2.2, y: hoop.boardTop + 0.1 }, "bird", "md");
    const confetti = ["#ffd23f", "#e8397f", "#6ec3ff", "#c5f26e", "#ff6b2c", "#ffffff"];
    this.fx.burst("confetti", { x: c.x, y: hoop.rimY + 0.2 }, { count: 10 + level * 10, speed: 3.5 + level * 0.8, dir: Math.PI / 2, spread: 2.2, colors: confetti, size: 0.09, life: 1.3, gravity: -5, drag: 1.2, sway: 0.6 });
    if (level >= 2) this.fx.burst("spark", { x: c.x, y: hoop.rimY }, { count: 4 + level * 3, speed: 4, colors: ["#ffd23f", "#ffffff"], size: 0.1, life: 0.6, gravity: -2 });
    if (level >= 3) this.fx.shake(0.06 + (level - 3) * 0.05);

    let wait = 1.25 + level * 0.3;
    if (this.birdHitAt >= 0) wait = Math.max(wait, 3.0 - (this.simTime - this.birdHitAt));
    this.resolve(Math.min(3.2, wait));
  }

  private onEnd(reason: EndReason): void {
    const shot = this.shot;
    if (!shot) return;
    if (reason === "out") this.halted = true;
    if (shot.scored || this.phase !== "flying") return;
    const near = this.log.rimTouches > 0 || this.minHoopDist < 0.8;
    const labels = this.log.distinct.map(this.label);
    const hoop = hoopOf(this.layout);
    const c = hoopCentre(hoop);
    if (near) {
      this.fx.caption(this.log.rimTouches > 0 ? "RIM OUT!" : "SO CLOSE!", { x: c.x - 0.8, y: hoop.boardTop + 0.7 }, "near", "lg");
      this.sound.ooh();
      this.kid.setPose("facepalm");
      this.hud.setChain(labels, "missed", null, "So close. No basket, no points.");
    } else {
      const lines = MISS_LINES[reason];
      const line = lines[this.missCount++ % lines.length];
      const at = reason === "out" ? { x: Math.min(VIEW_RECT.maxX - 1.5, Math.max(1.5, shot.pos.x)), y: Math.min(6.5, Math.max(2.5, shot.pos.y)) } : { x: shot.pos.x, y: 1.6 };
      this.fx.caption(line, at, "miss", "md");
      this.sound.groan();
      this.kid.setPose("groan");
      this.hud.setChain(labels, "missed", null, labels.length ? "Great route. No basket, no points." : "No basket, no points.");
    }
    this.resolve(near ? 1.2 : reason === "out" ? 0.8 : 0.9);
  }

  // ------------------------------------------------------------------ aim

  private setAim(aim: Aim, dragging: boolean): void {
    this.aim = aim;
    this.dragging = dragging;
    this.hud.setAim(aim);
    this.kid.setAimPower(aim.powerTenths / 1000);
  }

  private onDragState(s: "start" | "cancel-zone" | "pulling" | "end"): void {
    this.dragging = s === "start" || s === "pulling" || s === "cancel-zone";
    if (this.phase === "ready") this.kid.setPose(s === "pulling" ? "aim" : "ready");
    if (s === "cancel-zone") this.hud.setHint("Let go here to cancel.");
    else if (s === "pulling") this.hud.setHint(`Speed ${launchSpeed(this.aim.powerTenths).toFixed(1)} of ${SPEED_MAX} m/s · let go to shoot`);
    else if (s === "end" && this.phase === "ready") this.hud.setHint(this.readyHint());
  }

  private nudge(kind: "angle+" | "angle-" | "power+" | "power-", fine: boolean): void {
    if (this.phase !== "ready" || this.overlay.open) return;
    const step = fine ? 1 : 5;
    const a = { ...this.aim };
    if (kind === "angle+") a.angleTenths += step;
    if (kind === "angle-") a.angleTenths -= step;
    if (kind === "power+") a.powerTenths += step;
    if (kind === "power-") a.powerTenths -= step;
    a.angleTenths = Math.max(0, Math.min(1800, a.angleTenths));
    a.powerTenths = Math.max(0, Math.min(1000, a.powerTenths));
    this.setAim(a, false);
    this.sound.click();
  }

  // ------------------------------------------------------------- toggles

  private toggleGhost(): void {
    this.ghostOn = !this.ghostOn;
    save(keys.ghost, this.ghostOn);
    this.aimView.setGhostVisible(this.ghostOn);
    this.hud.setToggles(this.ghostOn, this.sound.isMuted);
  }

  private toggleMute(): void {
    this.sound.unlock();
    this.sound.setMuted(!this.sound.isMuted);
    save(keys.muted, this.sound.isMuted);
    this.hud.setToggles(this.ghostOn, this.sound.isMuted);
    if (!this.sound.isMuted) this.sound.click();
  }

  // ----------------------------------------------------------------- HUD

  private updateStatus(): void {
    const m = this.mode;
    if (!m) return;
    if (m.kind === "freestyle") {
      const best = load<BestRound | null>(keys.best(m.layout.id), null);
      this.hud.setFreestyle(m.score, m.shotsLeft, SHOTS_PER_ROUND, m.bestChain, Math.max(best?.score ?? 0, 0));
    } else {
      const best = load<number | null>(keys.challenge(m.def.id), null);
      this.hud.setChallenge(m.def, requirementProgress(m.def.requirement, this.log), this.label, Math.max(1, m.attempts + (this.phase === "ready" ? 1 : 0)), best);
    }
  }

  private insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private measureInsets(): void {
    const stageRect = this.stage.container.getBoundingClientRect();
    const top = document.querySelector<HTMLElement>(".hud-top");
    const bottom = document.querySelector<HTMLElement>(".hud-bottom");
    const hudVisible = !this.hud.root.hidden;
    const t = hudVisible && top ? Math.max(0, top.getBoundingClientRect().bottom - stageRect.top) : 8;
    const b = hudVisible && bottom ? Math.max(0, stageRect.bottom - bottom.getBoundingClientRect().top) : 8;
    const next = { top: Math.round(t), right: 0, bottom: Math.round(b), left: 0 };
    document.documentElement.style.setProperty("--hud-top", `${next.top}px`);
    if (next.top !== this.insets.top || next.bottom !== this.insets.bottom) {
      this.insets = next;
      this.stage.setInsets(next);
    }
  }

  // -------------------------------------------------------------- overlay

  private overlayModel(extra: Partial<OverlayModel> = {}): OverlayModel {
    const bests = CHALLENGES.map((c) => load<number | null>(keys.challenge(c.id), null));
    return {
      layouts: LAYOUTS.map((def) => ({ def, best: load<BestRound | null>(keys.best(def.id), null)?.score ?? 0 })),
      challenges: CHALLENGES.map((def, i) => ({
        def,
        layoutName: layoutById(def.layoutId).name,
        best: bests[i],
        locked: i > 0 && bests[i - 1] === null && bests[i] === null,
        label: (id: string) => layoutById(def.layoutId).props.find((p) => p.id === id)?.label ?? id,
      })),
      inGame: this.mode && this.phase !== "idle" ? this.mode.kind : null,
      touch: window.matchMedia("(pointer: coarse)").matches,
      ...extra,
    };
  }

  private showScreen(screen: Screen, from: Screen | null = null, extra: Partial<OverlayModel> = {}): void {
    this.input.cancel();
    this.overlay.show(screen, this.overlayModel(extra), from);
  }

  private openPause(): void {
    if (!this.mode || this.phase === "idle") return;
    this.showScreen("pause");
  }

  private onEscape(): void {
    if (this.overlay.open) {
      const s = this.overlay.screen;
      if (s === "title" || s === "summary" || s === "complete") return;
      if (s === "pause") this.onOverlayAction("close");
      else this.overlay.goBack();
      return;
    }
    this.openPause();
  }

  private onOverlayAction(action: string, id?: string): void {
    this.sound.unlock();
    this.sound.click();
    const current = this.overlay.screen;
    switch (action) {
      case "freestyle":
        this.showScreen("freestyle", current === "summary" || current === "complete" ? null : current);
        break;
      case "challenges":
        this.showScreen("challenges", current === "summary" || current === "complete" ? null : current);
        break;
      case "help":
        this.showScreen("help", current);
        break;
      case "play-layout":
        if (id) this.startFreestyle(id);
        break;
      case "play-challenge":
        if (id) this.startChallenge(id);
        break;
      case "replay":
        if (this.mode) this.startFreestyle(this.mode.layout.id);
        break;
      case "restart":
        if (this.mode?.kind === "challenge") this.startChallenge(this.mode.def.id);
        else if (this.mode) this.startFreestyle(this.mode.layout.id);
        break;
      case "next-challenge": {
        const m = this.mode;
        const idx = m?.kind === "challenge" ? CHALLENGES.indexOf(m.def) : -1;
        const next = CHALLENGES[idx + 1];
        if (next) this.startChallenge(next.id);
        break;
      }
      case "close":
        if (this.mode && this.phase !== "idle") this.overlay.hide();
        else if (!this.mode) this.showScreen("title");
        break;
    }
  }
}

export const TICKS_PER_SECOND = TICK_RATE;

import type { Collider, EventQueue, RigidBody, World } from "@dimforge/rapier2d-deterministic-compat";
import { type HoopDef, type LayoutDef, hoopCentre, hoopOf } from "../props/defs.ts";
import type { PropSim } from "../props/propSim.ts";
import { type BasketGeometry, type BasketTracker, basketStep, newBasketTracker } from "./basket.ts";
import {
  BALL_RADIUS,
  GRAVITY,
  LOW_ROLL_MARGIN,
  LOW_ROLL_TICKS,
  MAX_SHOT_TICKS,
  SETTLE_SPEED,
  SETTLE_TICKS,
  WORLD_MAX_X,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from "./constants.ts";
import { launchVelocity } from "./launch.ts";
import type { Rapier } from "./rapier.ts";
import type { Aim, ColliderTag, EndReason, ImpactEvent, SimEvent, Vec2 } from "./types.ts";
import { buildWorld, createBall } from "./world.ts";

export interface ShotSetup {
  layout: LayoutDef;
  aim: Aim;
  /**
   * Ticks since the attempt started when the ball was released. Moving props
   * (the seagull) are at this point in their loop at launch.
   */
  releaseTick: number;
}

/**
 * One shot, from release until the ball scores, settles or leaves.
 * Advance it with step(), one fixed tick at a time. It knows nothing about
 * rendering or scoring; it reports what happened as events.
 */
export class ShotSim {
  readonly setup: ShotSetup;
  readonly hoop: HoopDef;
  readonly basket: BasketTracker = newBasketTracker();
  tick = 0;
  pos: Vec2;
  prev: Vec2;
  vel: Vec2;
  angle = 0;
  angvel = 0;
  scoredTick = -1;
  ended: EndReason | null = null;
  rimTouched = false;

  private readonly world: World;
  private readonly queue: EventQueue;
  private readonly ball: RigidBody;
  private readonly ballHandle: number;
  private readonly tags: Map<number, ColliderTag>;
  private readonly colliders: Map<number, Collider>;
  private readonly props: PropSim[];
  private readonly propByObject = new Map<string, PropSim>();
  private readonly contacts = new Map<string, number>();
  private readonly basketGeom: BasketGeometry;
  private readonly boostHeight: number;
  private slowTicks = 0;
  private lowTicks = 0;
  private disposed = false;

  constructor(R: Rapier, setup: ShotSetup) {
    this.setup = setup;
    const built = buildWorld(R, setup.layout, { staticOnly: false, startPhase: setup.releaseTick });
    this.world = built.world;
    this.tags = built.tags;
    this.colliders = built.colliders;
    this.props = built.props;
    for (const p of this.props) this.propByObject.set(p.def.id, p);
    const v = launchVelocity(setup.aim);
    const ball = createBall(R, this.world, setup.layout.launch, v);
    this.ball = ball.body;
    this.ballHandle = ball.collider.handle;
    this.queue = new R.EventQueue(true);
    this.pos = { ...setup.layout.launch };
    this.prev = { ...this.pos };
    this.vel = v;
    this.hoop = hoopOf(setup.layout);
    const c = hoopCentre(this.hoop);
    this.basketGeom = { cx: c.x, rimY: this.hoop.rimY, rimHalf: this.hoop.rimHalf, tubeR: this.hoop.tubeR, ballR: BALL_RADIUS };
    // A slow ball can still be relaunched if it can reach a trampoline mat.
    let boost = Infinity;
    for (const d of setup.layout.props) if (d.type === "trampoline") boost = Math.min(boost, d.height + BALL_RADIUS);
    this.boostHeight = boost;
  }

  get scored(): boolean {
    return this.scoredTick >= 0;
  }

  get phaseTick(): number {
    return this.setup.releaseTick + this.tick;
  }

  step(): SimEvent[] {
    if (this.disposed) return [];
    const events: SimEvent[] = [];
    const emit = (e: SimEvent) => events.push(e);
    const nextPhase = this.setup.releaseTick + this.tick + 1;
    for (const p of this.props) p.beforeStep?.(nextPhase);

    const lv = this.ball.linvel();
    const velBefore = { x: lv.x, y: lv.y };
    this.prev = this.pos;
    this.world.step(this.queue);
    this.tick += 1;
    const tick = this.tick;

    const started: number[] = [];
    this.queue.drainCollisionEvents((h1, h2, isStarted) => {
      const other = h1 === this.ballHandle ? h2 : h2 === this.ballHandle ? h1 : null;
      if (other === null) return;
      const tag = this.tags.get(other);
      if (!tag) return;
      const n = this.contacts.get(tag.objectId) ?? 0;
      if (isStarted) {
        this.contacts.set(tag.objectId, n + 1);
        // Only a fresh contact with an object is an impact; touching a second
        // collider of an object the ball is already on is the same contact.
        if (n === 0) started.push(other);
      } else {
        this.contacts.set(tag.objectId, Math.max(0, n - 1));
      }
    });

    if (started.length) {
      const t = this.ball.translation();
      const ballPos = { x: t.x, y: t.y };
      for (const handle of started) {
        const tag = this.tags.get(handle)!;
        const collider = this.colliders.get(handle)!;
        const hit = this.contactInfo(collider, ballPos, velBefore);
        const impact: ImpactEvent = {
          type: "impact",
          tick,
          objectId: tag.objectId,
          kind: tag.kind,
          part: tag.part,
          eligible: tag.eligible,
          point: hit.point,
          normal: hit.normal,
          speed: Math.max(0, -(velBefore.x * hit.normal.x + velBefore.y * hit.normal.y)),
        };
        events.push(impact);
        if (tag.kind === "rim") this.rimTouched = true;
        this.propByObject.get(tag.objectId)?.onImpact?.({
          tick,
          part: tag.part,
          ballPos,
          velBefore,
          normal: hit.normal,
          setBallVelocity: (v) => this.ball.setLinvel(v, true),
          emit,
        });
      }
    }

    for (const p of this.props) p.afterStep?.(tick, emit);

    const t = this.ball.translation();
    const v = this.ball.linvel();
    this.pos = { x: t.x, y: t.y };
    this.vel = { x: v.x, y: v.y };
    this.angle = this.ball.rotation();
    this.angvel = this.ball.angvel();

    if (basketStep(this.basket, this.basketGeom, this.prev, this.pos) === "scored") {
      this.scoredTick = tick;
      events.push({ type: "basket", tick, swish: !this.rimTouched, point: { ...this.pos } });
    }

    if (!this.ended) {
      const reason = this.checkEnd();
      if (reason) {
        this.ended = reason;
        events.push({ type: "end", tick, reason });
      }
    }
    return events;
  }

  private contactInfo(collider: Collider, ballPos: Vec2, velBefore: Vec2): { point: Vec2; normal: Vec2 } {
    const proj = collider.projectPoint(ballPos, true);
    if (proj && !proj.isInside) {
      const nx = ballPos.x - proj.point.x;
      const ny = ballPos.y - proj.point.y;
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len > 1e-6) return { point: { x: proj.point.x, y: proj.point.y }, normal: { x: nx / len, y: ny / len } };
    }
    const sp = Math.sqrt(velBefore.x * velBefore.x + velBefore.y * velBefore.y) || 1;
    return { point: { ...ballPos }, normal: { x: -velBefore.x / sp, y: -velBefore.y / sp } };
  }

  private checkEnd(): EndReason | null {
    const { pos, vel } = this;
    if (pos.x < WORLD_MIN_X || pos.x > WORLD_MAX_X || pos.y < WORLD_MIN_Y) return "out";
    const speed2 = vel.x * vel.x + vel.y * vel.y;
    this.slowTicks = speed2 < SETTLE_SPEED * SETTLE_SPEED ? this.slowTicks + 1 : 0;
    if (this.slowTicks >= SETTLE_TICKS) return "settled";
    // Rolling along the driveway without the energy to get back up to the
    // rim (or onto a trampoline) is a miss; no need to watch it roll away.
    const reach = pos.y + speed2 / (2 * -GRAVITY);
    const low = pos.y < BALL_RADIUS + 0.15 && reach < this.hoop.rimY - LOW_ROLL_MARGIN && reach < this.boostHeight;
    this.lowTicks = low ? this.lowTicks + 1 : 0;
    if (this.lowTicks >= LOW_ROLL_TICKS) return "rolled";
    if (this.tick >= MAX_SHOT_TICKS) return "timeout";
    return null;
  }

  /** Render-friendly state of every prop, keyed by prop id. */
  propStates(): Record<string, Record<string, number | boolean>> {
    const out: Record<string, Record<string, number | boolean>> = {};
    for (const p of this.props) if (p.state) out[p.def.id] = p.state();
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.free();
    this.world.free();
  }
}

export interface ShotResult {
  scored: boolean;
  scoredTick: number;
  endReason: EndReason | "scored";
  ticks: number;
  events: SimEvent[];
  path: Vec2[];
}

/** Run a whole shot headlessly (tests, the sweeper, solution checks). */
export function runShot(
  R: Rapier,
  setup: ShotSetup,
  opts: { recordPath?: boolean; afterScoreTicks?: number } = {},
): ShotResult {
  const sim = new ShotSim(R, setup);
  const events: SimEvent[] = [];
  const path: Vec2[] = opts.recordPath ? [{ ...sim.pos }] : [];
  const after = opts.afterScoreTicks ?? 0;
  try {
    while (!sim.ended) {
      events.push(...sim.step());
      if (opts.recordPath) path.push({ ...sim.pos });
      if (sim.scored && sim.tick - sim.scoredTick >= after) break;
    }
    return {
      scored: sim.scored,
      scoredTick: sim.scoredTick,
      endReason: sim.scored ? "scored" : (sim.ended ?? "timeout"),
      ticks: sim.tick,
      events,
      path,
    };
  } finally {
    sim.dispose();
  }
}

import type { ChallengeDef } from "../levels/challenges.ts";
import type { LayoutDef } from "../props/defs.ts";
import { describeRequirement } from "../rules/challenges.ts";
import { formatPoints } from "../rules/scoring.ts";
import { esc } from "./hud.ts";

export type Screen = "title" | "freestyle" | "challenges" | "pause" | "help" | "summary" | "complete";

export interface ChallengeRow {
  def: ChallengeDef;
  layoutName: string;
  best: number | null;
  locked: boolean;
  label: (id: string) => string;
}

export interface SummaryModel {
  layout: LayoutDef;
  score: number;
  baskets: number;
  shots: number;
  bestShot: number;
  bestChain: string[] | null;
  newBest: boolean;
  previousBest: number;
}

export interface CompleteModel {
  def: ChallengeDef;
  attempts: number;
  best: number;
  newBest: boolean;
  hasNext: boolean;
  label: (id: string) => string;
}

export interface OverlayModel {
  layouts: { def: LayoutDef; best: number }[];
  challenges: ChallengeRow[];
  inGame: "freestyle" | "challenge" | null;
  summary?: SummaryModel;
  complete?: CompleteModel;
  touch: boolean;
}

/** Menus and result cards drawn over the (still visible) driveway. */
export class Overlay {
  private readonly el: HTMLElement;
  private readonly onAction: (action: string, id?: string) => void;
  private readonly ac = new AbortController();
  screen: Screen | null = null;
  private back: Screen | null = null;

  constructor(el: HTMLElement, onAction: (action: string, id?: string) => void) {
    this.el = el;
    this.onAction = onAction;
    el.addEventListener(
      "click",
      (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
        if (!b || b.disabled) return;
        const a = b.dataset.action!;
        if (a === "back") this.goBack();
        else this.onAction(a, b.dataset.id);
      },
      { signal: this.ac.signal },
    );
  }

  get open(): boolean {
    return this.screen !== null;
  }

  dispose(): void {
    this.ac.abort();
  }

  hide(): void {
    this.screen = null;
    this.back = null;
    this.el.hidden = true;
    this.el.replaceChildren();
  }

  /** Show a screen. `from` is where the Back button returns to. */
  show(screen: Screen, m: OverlayModel, from: Screen | null = null): void {
    this.screen = screen;
    this.back = from;
    this.el.hidden = false;
    this.el.innerHTML = `<div class="panel panel--${screen}" role="dialog" aria-modal="true" aria-labelledby="ov-title">${this.render(screen, m)}</div>`;
    this.lastModel = m;
    const focus = this.el.querySelector<HTMLElement>(".primary, [data-action]:not([disabled])");
    focus?.focus({ preventScroll: true });
  }

  private lastModel: OverlayModel | null = null;

  goBack(): void {
    if (this.back && this.lastModel) this.show(this.back, this.lastModel, this.back === "title" ? null : this.backOf(this.back));
    else this.onAction("close");
  }

  private backOf(s: Screen): Screen | null {
    if (s === "freestyle" || s === "challenges" || s === "help") return this.lastModel?.inGame ? "pause" : "title";
    return null;
  }

  private render(screen: Screen, m: OverlayModel): string {
    const backBtn = (label = "Back") => `<button class="btn btn--ghost" data-action="back">${label}</button>`;
    switch (screen) {
      case "title":
        return `
          <div class="logo" id="ov-title">BANK IT<span class="logo-dot">.</span></div>
          <p class="tagline">Take the scenic route.</p>
          <div class="mode-cards">
            <button class="mode-card primary" data-action="freestyle">
              <span class="kicker">10 shots · any route</span>
              <strong>Freestyle</strong>
              <span class="mc-copy">Bank off roofs, bins, trampolines and the odd seagull. Every prop multiplies.</span>
            </button>
            <button class="mode-card" data-action="challenges">
              <span class="kicker">${m.challenges.length} trick shots</span>
              <strong>Called Shots</strong>
              <span class="mc-copy">We call the route. You make it. Unlimited retries.</span>
            </button>
          </div>
          <button class="btn btn--ghost" data-action="help">How to play</button>`;
      case "freestyle":
        return `
          <span class="kicker">Freestyle · 10 shots</span>
          <h2 id="ov-title">Pick a driveway</h2>
          <div class="layout-cards">
            ${m.layouts
              .map(
                ({ def, best }, i) => `
              <button class="layout-card ${i === 0 ? "primary" : ""}" data-action="play-layout" data-id="${esc(def.id)}">
                <span class="plate">${esc(def.number)}</span>
                <strong>${esc(def.name)}</strong>
                <span class="lc-copy">${esc(def.tagline)}</span>
                <span class="lc-best">${best > 0 ? `Best ${formatPoints(best)}` : "No score yet"}</span>
              </button>`,
              )
              .join("")}
          </div>
          ${backBtn()}`;
      case "challenges":
        return `
          <span class="kicker">Called Shots</span>
          <h2 id="ov-title">Call it. Make it.</h2>
          <ol class="ch-list">
            ${m.challenges
              .map(
                (c) => `
              <li><button class="ch-row ${c.best ? "is-done" : ""}" data-action="play-challenge" data-id="${esc(c.def.id)}" ${c.locked ? "disabled" : ""}>
                <span class="plate">${esc(c.def.number)}</span>
                <span class="ch-main"><strong>${esc(c.def.title)}</strong><span class="ch-req">${esc(describeRequirement(c.def.requirement, c.label))}</span></span>
                <span class="ch-meta">${esc(c.layoutName)}<b>${c.locked ? "Locked" : c.best ? `✓ ${c.best} ${c.best === 1 ? "try" : "tries"}` : "New"}</b></span>
              </button></li>`,
              )
              .join("")}
          </ol>
          ${backBtn()}`;
      case "pause":
        return `
          <span class="kicker">Time out</span>
          <h2 id="ov-title">Paused</h2>
          <div class="stack">
            <button class="btn primary" data-action="close">Back to the driveway</button>
            <button class="btn" data-action="restart">${m.inGame === "challenge" ? "Restart challenge" : "Restart round"}</button>
            <button class="btn" data-action="freestyle">Freestyle driveways</button>
            <button class="btn" data-action="challenges">Called Shots</button>
            <button class="btn btn--ghost" data-action="help">How to play</button>
          </div>`;
      case "help":
        return `
          <span class="kicker">How to play</span>
          <h2 id="ov-title">Take the scenic route</h2>
          <ul class="help-list">
            <li><b>${m.touch ? "Drag" : "Drag"} back</b> from the ball (or anywhere on the driveway). The arrow shows direction and power. Let go to shoot. Drag back to the start to cancel.</li>
            <li><b>Fine-tune</b> with the ◀ ▶ and − + buttons, or the arrow keys (hold Shift for tiny steps). Your last aim is kept for the next try.</li>
            <li>The <b>dotted line</b> shows the start of the shot and stops at the first thing it will hit. The <b>faint dashed line</b> is your last shot.</li>
            <li><b>Keys:</b> Space shoot · R retry · G ghost path · M mute · Esc menu.</li>
          </ul>
          <h3>Scoring</h3>
          <ul class="help-list help-list--score">
            <li>Basket <b>100</b>. Each different prop first <b>+100</b>. Seagull <b>+200</b> bonus. A bounce on the driveway <b>+50</b>.</li>
            <li>Then <b>× the number of props</b>. Roof → trampoline → bin → basket is (100 + 300) × 3 = <b>1,200</b>.</li>
            <li>Nothing counts until it drops. The rim is free.</li>
          </ul>
          ${backBtn("Got it")}`;
      case "summary": {
        const s = m.summary!;
        return `
          <span class="kicker">Round over · ${esc(s.layout.number)} ${esc(s.layout.name)}</span>
          <div class="big-score" id="ov-title">${formatPoints(s.score)}</div>
          ${s.newBest ? `<p class="new-best">New driveway best!</p>` : s.previousBest > 0 ? `<p class="prev-best">Driveway best ${formatPoints(s.previousBest)}</p>` : ""}
          <dl class="summary-stats">
            <div><dt>Baskets</dt><dd>${s.baskets}/${s.shots}</dd></div>
            <div><dt>Best shot</dt><dd>${formatPoints(s.bestShot)}</dd></div>
            <div class="wide"><dt>Best chain</dt><dd>${s.bestChain ? (s.bestChain.length ? esc(s.bestChain.join(" → ")) + " → BASKET" : "Straight in") : "—"}</dd></div>
          </dl>
          <div class="stack stack--row">
            <button class="btn primary" data-action="replay">Play again</button>
            <button class="btn" data-action="freestyle">Change driveway</button>
          </div>`;
      }
      case "complete": {
        const c = m.complete!;
        return `
          <span class="kicker">Called it! · Challenge ${esc(c.def.number)}</span>
          <h2 id="ov-title">${esc(c.def.title)}</h2>
          <p class="ch-done-req">${esc(describeRequirement(c.def.requirement, c.label))}</p>
          <p class="ch-done">Made in <b>${c.attempts}</b> ${c.attempts === 1 ? "attempt" : "attempts"}${c.newBest ? " — a new best!" : `. Best: ${c.best}.`}</p>
          <div class="stack stack--row">
            ${c.hasNext ? '<button class="btn primary" data-action="next-challenge">Next challenge</button>' : '<button class="btn primary" data-action="challenges">All challenges</button>'}
            <button class="btn" data-action="restart">Go again</button>
            ${c.hasNext ? '<button class="btn btn--ghost" data-action="challenges">All challenges</button>' : ""}
          </div>`;
      }
    }
  }
}

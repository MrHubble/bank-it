import type { ChallengeDef } from "../levels/challenges.ts";
import type { RequirementProgress } from "../rules/challenges.ts";
import { formatPoints, type ShotScore } from "../rules/scoring.ts";
import { formatAngle, formatPower } from "../sim/launch.ts";
import type { Aim } from "../sim/types.ts";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export interface HudCallbacks {
  nudge(kind: "angle+" | "angle-" | "power+" | "power-", fine: boolean): void;
  shoot(): void;
  retry(): void;
  toggleGhost(): void;
  toggleMute(): void;
  menu(): void;
  gesture(): void;
}

export type ChainState = "flying" | "scored" | "missed";

/** The compact in-game HUD. Plain DOM, so it stays crisp and accessible. */
export class Hud {
  readonly root = $("hud");
  private readonly modeLabel = $("mode-label");
  private readonly status = $("status");
  private readonly chain = $("chain");
  private readonly hint = $("hint");
  private readonly angle = $("angle-readout");
  private readonly power = $("power-readout");
  private readonly shootBtn = $<HTMLButtonElement>("btn-shoot");
  private readonly retryBtn = $<HTMLButtonElement>("btn-retry");
  private readonly ghostBtn = $<HTMLButtonElement>("btn-ghost");
  private readonly soundBtn = $<HTMLButtonElement>("btn-sound");
  private readonly menuBtn = $<HTMLButtonElement>("btn-menu");
  private readonly ac = new AbortController();
  private repeatTimer = 0;
  private chainKey = "";
  private chainCount = 0;

  constructor(cb: HudCallbacks) {
    const o = { signal: this.ac.signal };
    this.shootBtn.addEventListener("click", () => cb.shoot(), o);
    this.retryBtn.addEventListener("click", () => cb.retry(), o);
    this.ghostBtn.addEventListener("click", () => cb.toggleGhost(), o);
    this.soundBtn.addEventListener("click", () => cb.toggleMute(), o);
    this.menuBtn.addEventListener("click", () => cb.menu(), o);
    this.root.addEventListener("pointerdown", () => cb.gesture(), o);
    // Hold a nudge button to keep nudging.
    for (const b of this.root.querySelectorAll<HTMLButtonElement>("[data-nudge]")) {
      const kind = b.dataset.nudge as "angle+" | "angle-" | "power+" | "power-";
      const stop = () => window.clearTimeout(this.repeatTimer);
      b.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          cb.gesture();
          cb.nudge(kind, e.shiftKey);
          stop();
          let delay = 380;
          const again = () => {
            cb.nudge(kind, false);
            delay = Math.max(45, delay * 0.8);
            this.repeatTimer = window.setTimeout(again, delay);
          };
          this.repeatTimer = window.setTimeout(again, delay);
        },
        o,
      );
      for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop, o);
      // Keyboard activation (Enter/Space on the focused button).
      b.addEventListener(
        "click",
        (e) => {
          if (e.detail === 0) cb.nudge(kind, false);
        },
        o,
      );
    }
  }

  dispose(): void {
    this.ac.abort();
    window.clearTimeout(this.repeatTimer);
  }

  setVisible(v: boolean): void {
    this.root.hidden = !v;
  }

  setMode(label: string): void {
    this.modeLabel.textContent = label;
  }

  setAim(aim: Aim): void {
    this.angle.textContent = formatAngle(aim);
    this.power.textContent = formatPower(aim);
  }

  setCanShoot(can: boolean): void {
    this.shootBtn.disabled = !can;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>("[data-nudge]")) b.disabled = !can;
  }

  setToggles(ghost: boolean, muted: boolean): void {
    this.ghostBtn.setAttribute("aria-pressed", String(ghost));
    this.ghostBtn.title = ghost ? "Hide the last shot's path (G)" : "Show the last shot's path (G)";
    this.soundBtn.setAttribute("aria-pressed", String(!muted));
    this.soundBtn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
    this.soundBtn.title = muted ? "Sound is off (M)" : "Sound is on (M)";
    this.soundBtn.classList.toggle("is-muted", muted);
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  setFreestyle(score: number, shotsLeft: number, total: number, bestChain: string[] | null, bestScore: number): void {
    this.status.className = "status chip";
    this.status.innerHTML = `
      <div class="stat"><span>Score</span><strong>${formatPoints(score)}</strong></div>
      <div class="stat"><span>Shots</span><strong>${shotsLeft}<small>/${total}</small></strong></div>
      <div class="stat stat--chain"><span>Best chain</span><strong>${
        bestChain ? (bestChain.length ? esc(bestChain.join(" → ")) : "Straight in") : "—"
      }</strong></div>
      <div class="stat stat--best"><span>Layout best</span><strong>${formatPoints(bestScore)}</strong></div>`;
  }

  setChallenge(c: ChallengeDef, progress: RequirementProgress, label: (id: string) => string, attempts: number, best: number | null): void {
    this.status.className = "status chip status--challenge";
    const req = c.requirement;
    const seq = req.kind === "sequence";
    const items =
      req.kind === "swish"
        ? `<li class="req ${progress.clean ? "" : "req--broken"}">No touches</li>`
        : progress.items
            .map(
              (i, n) =>
                `${seq && n > 0 ? '<li class="req-arrow" aria-hidden="true">→</li>' : ""}<li class="req ${i.met ? "req--met" : ""} ${
                  i.next ? "req--next" : ""
                }">${i.met ? "✓ " : ""}${esc(label(i.objectId).toUpperCase())}</li>`,
            )
            .join(req.kind === "all" ? '<li class="req-arrow" aria-hidden="true">+</li>' : "");
    this.status.innerHTML = `
      <div class="ch-head"><span class="ch-num">${esc(c.number)}</span><strong>${esc(c.title)}</strong></div>
      <ul class="reqs" aria-label="Requirements">${items}<li class="req-arrow" aria-hidden="true">→</li><li class="req req--basket">BASKET</li></ul>
      <div class="ch-tries">Attempt ${Math.max(1, attempts)}${best ? ` · Best ${best}` : ""}</div>`;
  }

  /** Live chain while the ball is in the air, then the result. */
  setChain(labels: string[], state: ChainState, score: ShotScore | null, extra = ""): void {
    const key = `${labels.join("|")}/${state}/${score?.total ?? 0}/${extra}`;
    if (key === this.chainKey) return;
    this.chainKey = key;
    if (!labels.length && state === "flying") {
      this.chain.innerHTML = "";
      this.chain.className = "chain";
      return;
    }
    // Only the newest link pops in; the rest of the chain stays put.
    const fresh = labels.length > this.chainCount ? labels.length - 1 : -1;
    this.chainCount = labels.length;
    const chips = labels.map((l, i) => `<span class="link${i === fresh ? " link--new" : ""}">${esc(l.toUpperCase())}</span>`);
    if (state === "scored") chips.push(`<span class="link link--basket link--new">BASKET!</span>`);
    const sep = '<span class="arrow" aria-hidden="true">→</span>';
    let tail = "";
    if (score && state !== "missed") {
      const parts = [`${score.base}`];
      if (score.objectPoints) parts.push(`${score.objectPoints}`);
      if (score.birdBonus) parts.push(`${score.birdBonus} bird`);
      if (score.groundBonus) parts.push(`${score.groundBonus} bounce`);
      const sum = parts.length > 1 ? `(${parts.join(" + ")})` : parts[0];
      const mult = score.multiplier > 1 ? ` × ${score.multiplier}` : "";
      tail =
        state === "scored"
          ? `<span class="chain-score">+${formatPoints(score.total)}</span><span class="chain-math">${esc(sum + mult)}</span>`
          : `<span class="chain-pending">${formatPoints(score.total)} if it drops</span>`;
    } else if (state === "missed") {
      tail = `<span class="chain-miss">${esc(extra || "No basket, no points")}</span>`;
    }
    const level = Math.min(4, labels.length);
    this.chain.className = `chain chain--${state} chain--lv${level}`;
    this.chain.innerHTML = `<div class="links">${chips.join(sep)}${labels.length && state === "flying" ? '<span class="bang">!</span>' : ""}</div>${tail}`;
  }

  clearChain(): void {
    this.chainKey = "";
    this.chainCount = 0;
    this.chain.innerHTML = "";
    this.chain.className = "chain";
  }
}

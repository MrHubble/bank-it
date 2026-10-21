import "./ui/styles.css";
import {installPageTouchZoom} from "./input/pageTouchZoom.ts";
import type {Game} from "./game/game.ts";
let liveGame: Game | null = null;
const pageTouch=installPageTouchZoom({isActivelyPlaying:()=>liveGame?.activelyPlayingForPageZoom??false,pauseGame:()=>liveGame?.pauseForPageZoom()});

// Physics (Rapier, with its WebAssembly inlined) and the game load in
// parallel as separate chunks, so a game update doesn't re-download physics.
async function boot(): Promise<void> {
  const bootEl = document.getElementById("boot");
  try {
    const [R, { Game }] = await Promise.all([import("./sim/rapier.ts").then((m) => m.loadRapier()), import("./game/game.ts")]);
    const game = new Game(R,pageTouch);
    liveGame = game;
    game.start();
    // Handy for browser tests and for tuning shots from the console.
    (window as unknown as { bankIt: unknown }).bankIt = game.debugApi();
    bootEl?.classList.add("is-done");
    window.setTimeout(() => bootEl?.remove(), 400);
  } catch (err) {
    console.error(err);
    const msg = bootEl?.querySelector("small");
    if (msg) msg.textContent = "This game needs WebGL and WebAssembly. Try reloading in Chrome, Safari or Firefox.";
  }
}

void boot();

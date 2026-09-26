# BANK IT

**Take the scenic route.** A trick-shot basketball game for [LeoToby](https://www.leotoby.com): bank a basketball off the garage roof, the wheelie bin, a trampoline, a garden umbrella and the odd passing seagull, then drop it through an oversized hoop above the garage door.

It plays at [leotoby.com/games/bank-it/](https://www.leotoby.com/games/bank-it/). This repository is the editable source; the LeoToby site only holds a built copy (see [Publishing to LeoToby](#publishing-to-leotoby)).

## How it plays

- **Aim:** drag back from the ball (or anywhere on the driveway) and let go. The arrow shows direction and power, and a short dotted line previews the start of the flight, stopping at the first thing the ball will touch. Drag back to where you started, press Esc, or lose the pointer to cancel.
- **Fine-tune:** the ◀ ▶ and − + buttons, or the arrow keys / WASD (hold Shift for 0.1 steps). Your last aim is kept between shots.
- **Keys:** Space or Enter shoots, R retries (at any moment, even mid-flight), G toggles the ghost of your last shot, M mutes, Esc opens the menu.

### Modes

- **Freestyle:** ten shots on one of three driveways. Any route counts. Best scores are saved per driveway in the browser.
- **Called Shots:** 14 authored challenges, from "off the bin" to a four-prop route with the seagull. Unlimited retries; the fewest attempts per challenge is saved.

### Scoring

| | Points |
|---|---|
| Basket | 100 |
| Each different prop hit before the basket | +100 |
| Seagull deflection | +200 on top |
| Bounce on the driveway (once per shot) | +50 |
| Then multiply by | the number of different props (at least 1) |

Roof → trampoline → bin → basket is (100 + 300) × 3 = 1,200. Repeat hits don't count twice, the rim and the driveway don't raise the multiplier, and nothing is banked unless the ball drops.

### Driveways

1. **Bin There**: garage roof, wheelie bin and the backboard. Direct shots, bank shots and simple combinations.
2. **Air Mail**: the bin makes way for a trampoline and a striped umbrella. High arcs, and routes that go over the hoop, off the roof, back across the driveway and home again.
3. **Flight Risk**: trampoline, bin and a seagull on patrol. Time the release to clip the gull.

## Stack

- [three.js](https://threejs.org) for the chunky toon-shaded 3D scene, with a fixed oblique orthographic camera: the play plane is drawn undistorted, and depth only slides things sideways so you see the tops and fronts of the props.
- [Rapier 2D](https://rapier.rs) (the deterministic build, `@dimforge/rapier2d-deterministic-compat`) for the physics. Fixed 120 Hz timestep, continuous collision detection on the ball, and a fresh world per shot, so the same aim and release timing always gives exactly the same result, in every browser.
- Plain TypeScript and DOM for the HUD, Web Audio for procedural sound, Vite to build, Vitest for tests.
- Fonts: Archivo and Space Mono (SIL Open Font License), bundled. Licences for the fonts, three.js and Rapier ship in `public/licenses/`.

## Development

Needs Node 22 (see `.mise.toml`).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # rules, basket detection, determinism, and every Called Shot solution
npm run typecheck
npm run build        # production build in dist/ for serving from /
```

### Code map

```
src/
  sim/        Physics: fixed-step shot simulation, launch maths, basket detection,
              aiming preview. Headless; runs in Node for tests and tools.
  props/      Data definitions and the physics side of every prop (hoop, garage,
              roof, bin, trampoline, umbrella, seagull) plus a registry.
  rules/      Pure scoring, the impact log (dedup and order) and challenge matching.
  levels/     The three layouts and the Called Shot list with recorded solutions.
  render/     three.js: stage, oblique camera, toon materials, scenery, kid, ball,
              aim/preview/ghost, effects, and the visual side of each prop.
  input/      Pointer drag with capture and cancel, keyboard.
  audio/      Procedural Web Audio sound effects and mute.
  ui/         HUD, menus and styles.
  game/       The controller that wires it all together, the fixed-step loop, storage.
scripts/      Design tools: sweep.ts, solve.ts, solutions.ts, draw.ts.
tests/        Vitest suites.
e2e/          Playwright scripts used to check the game in Chromium.
```

### Adding a prop

A new prop (washing line, garden gnome, skateboard…) needs a definition type in `src/props/defs.ts`, a physics factory in `src/props/` registered in `src/props/registry.ts`, and a view in `src/render/props/` registered in `src/render/props/index.ts`. Layouts are plain data in `src/levels/layouts.ts`; the game loop doesn't change. Props report impacts as events; a prop can react in the physics (the trampoline boost, the seagull bumper, the umbrella folding) through `onImpact`/`afterStep`, and the view reacts cosmetically without touching collision shapes.

### Designing layouts and challenges

The simulation runs headlessly, so layouts are tuned by firing thousands of shots rather than by feel alone:

```bash
# Fire a grid of shots (angles and powers in tenths) and group the baskets by route.
node scripts/sweep.ts bin-there --angles 150:1500:5 --powers 100:1000:5 --out sweeps/bin-there.json
# For the seagull, only replay release timings where the gull can meet the ball.
node scripts/sweep.ts flight-risk --angles 100:1700:10 --powers 0:1000:10 --smart-bird 4 --out sweeps/flight-risk.json
# Try geometry changes without editing files.
node scripts/sweep.ts air-mail --patch '{"umbrella":{"x":10.2,"tilt":10}}'
# Find the most forgiving solution for a requirement.
node scripts/solve.ts sweeps/air-mail.json --seq roof,umbrella,backboard
# Draw a layout's colliders and some shots (angle/power[/tick]) to SVG/PNG.
node scripts/draw.ts flight-risk out.svg 540/210/519
# Replay every Called Shot solution and write SOLUTIONS.md.
node scripts/solutions.ts --write
```

### Browser checks

`e2e/` holds Playwright scripts that drive the real game in Chromium through a small test hook (`window.bankIt`). Serve a build first, then run them:

```bash
npm run build && npx vite preview --port 4311 &
node e2e/verify.mjs http://localhost:4311/          # 52 checks: mouse, touch, keyboard, retries, every Called Shot, persistence, resizing, pausing
BANKIT_URL=http://localhost:4311/ node e2e/sizes.mjs /tmp/shots   # screenshots at desktop and phone sizes
```

They use Playwright from a global install or `npx playwright`, with its bundled Chromium.

Every Called Shot records a verified solution (launch position, angle, power and release tick) in `src/levels/challenges.ts`. `tests/solutions.test.ts` replays them all, and [SOLUTIONS.md](SOLUTIONS.md) lists them with how forgiving each one is.

## Publishing to LeoToby

The LeoToby site serves a static copy of this game at `/games/bank-it/`. To update it:

1. Build with the LeoToby base path:

   ```bash
   npm run build:leotoby      # writes dist-leotoby/ with /games/bank-it/ asset URLs
   ```

2. Replace the copy in the LeoToby repository (a sibling checkout of [MrHubble/leotoby](https://github.com/MrHubble/leotoby)):

   ```bash
   npm run copy:leotoby -- ../leotoby     # empties public/games/bank-it/ and copies dist-leotoby/ in
   ```

3. Commit both repositories. Cloudflare Pages rebuilds leotoby.com from the LeoToby repository.

Keep the `/games/bank-it/` base: the built `index.html` loads its scripts, styles and fonts from that path.

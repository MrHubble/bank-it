# bank-it touch zoom — 21 October 2026

Started from clean latest remote main `ff25322c13b08219c124067c3659b75b193e7dd0`. Mark requested accidental page-zoom protection throughout the web games.

Running play now applies `touch-action: none` to a shared ancestor of canvas and controls. Non-passive capture Touch/Gesture listeners cancel legacy pinch and rapid gameplay double-tap defaults without stopping propagation. Active one-shot HUD actions run on pointerdown with native keyboard/assistive click fallback. Gesture ownership clears on reset, cancel, focus loss and menus. Desktop browser keyboard/wheel zoom is outside this guard.

Drag-to-aim/release-to-shoot, dead-zone and cancelled-drag restoration remain. HUD actions accept a second finger; menu buttons retain native activation and scrolling.

56 automated tests and the typechecked Vite production build pass. Final local chromium 29/29, webkit 19/19 pass. Screenshots were visually reviewed. Native-input evidence is in `local/`; phone 390×844 and tablet 820×1180 keep scale 1 and visible controls in bounds. Chromium uses actual CDP multitouch. WebKit uses native taps plus separately labelled synthetic Touch/Gesture policy probes; physical iPad/Safari pinch is unverified. Functional browser jobs may overlap other games; no new performance claim is made.

Official rationale: [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [WebKit viewport limits](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/), [Apple legacy gesture handling](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html), [MDN passive listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener).

Published runtime `6688aa2723c781b7b1ca842fc071ee70ec5d1186` through existing Pages project `bank-it` and main. Automatic production deployment [`6c87ac3a-79a9-4fd0-86a4-2b452c88e594`](https://dash.cloudflare.com/?to=/fa68dcf0ffe51e98df8c91c47b5acf76/pages/view/bank-it/6c87ac3a-79a9-4fd0-86a4-2b452c88e594) succeeded. All 13 files at [the canonical domain](https://bank-it.leotoby.com/) returned HTTPS 200 and matched the tested SHA-256 bytes (4,399,030 raw bytes). Hosting/build settings and canonical URLs are unchanged.

Live Chromium 27/27 and WebKit 17/17 pass (44 total), with no page exceptions or failed requests. Final live phone/tablet captures were visually reviewed. Exact files, check-run receipt and actual input results are in `production/`. These checks do not establish physical iPad/Safari pinch behavior or device performance.

Focus lifecycle follow-up: descendant HUD blur must not clear a game touch. Blur/pagehide use non-capturing listeners and require the surface itself as event target; Touch/Gesture events remain capture/non-passive. A focused policy regression and real DOM focus-change browser probe cover this. The corrected guard passes chromium 29/29, webkit 19/19 locally; publication verification follows.

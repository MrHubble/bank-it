# bank-it touch zoom — 21 October 2026

Started from clean latest remote main `ff25322c13b08219c124067c3659b75b193e7dd0`. Mark requested accidental page-zoom protection throughout the web games.

Running play now applies `touch-action: none` to a shared ancestor of canvas and controls. Non-passive capture Touch/Gesture listeners cancel legacy pinch and rapid gameplay double-tap defaults without stopping propagation. Active one-shot HUD actions run on pointerdown with native keyboard/assistive click fallback. Gesture ownership clears on reset, cancel, focus loss and menus. Desktop browser keyboard/wheel zoom is outside this guard.

Drag-to-aim/release-to-shoot, dead-zone and cancelled-drag restoration remain. HUD actions accept a second finger; menu buttons retain native activation and scrolling.

56 automated tests and the typechecked Vite production build pass. Final local chromium 31/31, webkit 21/21 pass. Screenshots were visually reviewed. Native-input evidence is in `local/`; phone 390×844 and tablet 820×1180 keep scale 1 and visible controls in bounds. Chromium uses actual CDP multitouch. WebKit uses native taps plus separately labelled synthetic Touch/Gesture policy probes; physical iPad/Safari pinch is unverified. Functional browser jobs may overlap other games; no new performance claim is made.

Official rationale: [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [WebKit viewport limits](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/), [Apple legacy gesture handling](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html), [MDN passive listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener).

Published corrected runtime `59f4ee45d3414c55b79e3b5e65d7ec0dca46040f` through existing Pages project `bank-it` and main. Automatic production deployment [`79c7b340-2be2-4e69-858c-97d738a961d9`](https://dash.cloudflare.com/?to=/fa68dcf0ffe51e98df8c91c47b5acf76/pages/view/bank-it/79c7b340-2be2-4e69-858c-97d738a961d9) succeeded. All 13 files at [the canonical domain](https://bank-it.leotoby.com/) returned HTTPS 200 and matched the tested SHA-256 bytes (4,399,104 raw bytes). Hosting/build settings and canonical URLs are unchanged.

Live Chromium 31/31 and WebKit 21/21 pass (52 total), with no page exceptions or failed requests. Final live phone/tablet captures were visually reviewed. Exact files, check-run receipt and actual input results are in `production/`. These checks do not establish physical iPad/Safari pinch behavior or device performance.

Focus lifecycle follow-up: descendant HUD blur must not clear a game touch. Blur/pagehide use non-capturing listeners and require the surface itself as event target; Touch/Gesture events remain capture/non-passive. A focused policy regression and real DOM focus-change browser probe cover this. The corrected guard passes chromium 31/31, webkit 21/21 locally; the same counts pass on production.

The existing visibility-change input cancellation also clears gesture ownership, verified through the actual controller listener.

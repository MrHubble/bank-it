# bank-it touch zoom — 21 October 2026

Started from clean latest remote main `ff25322c13b08219c124067c3659b75b193e7dd0`. Mark requested accidental page-zoom protection throughout the web games.

Running play now applies `touch-action: none` to a shared ancestor of canvas and controls. Non-passive capture Touch/Gesture listeners cancel legacy pinch and rapid gameplay double-tap defaults without stopping propagation. Active one-shot HUD actions run on pointerdown with native keyboard/assistive click fallback. Gesture ownership clears on reset, cancel, focus loss and menus. Desktop browser keyboard/wheel zoom is outside this guard.

Drag-to-aim/release-to-shoot, dead-zone and cancelled-drag restoration remain. HUD actions accept a second finger; menu buttons retain native activation and scrolling.

55 automated tests and the typechecked Vite production build pass. Final local chromium 27/27, webkit 17/17 pass. Screenshots were visually reviewed. Native-input evidence is in `local/`; phone 390×844 and tablet 820×1180 keep scale 1 and visible controls in bounds. Chromium uses actual CDP multitouch. WebKit uses native taps plus separately labelled synthetic Touch/Gesture policy probes; physical iPad/Safari pinch is unverified. Functional browser jobs may overlap other games; no new performance claim is made.

Official rationale: [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [WebKit viewport limits](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/), [Apple legacy gesture handling](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html), [MDN passive listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener).

Existing Pages project `bank-it`, main and canonical https://bank-it.leotoby.com/ remain. Publication, exact hashes and live results are pending.

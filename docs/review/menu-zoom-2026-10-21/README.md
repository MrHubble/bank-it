# Whole-page touch zoom and recovery — 21 October 2026

This follow-up replaces the earlier active-play-only policy. Loading, intro/build, pause and results now protect against native page pinch and accidental rapid-tap zoom, while ordinary menus keep vertical scrolling and native form controls. Gameplay retains its existing control paths.

A browser page already enlarged above 1.01 pauses the simulation, admits native pan/pinch recovery across every descendant, and blocks Begin/Resume. A real inverse pinch back to scale 1 restores protection and leaves the game paused for explicit Resume. Browser touch ownership survives ordinary input clearing, Reset and pause transitions until the actual fingers lift; hidden-page cleanup, blur and pagehide release stale ownership.

Challenge-list actions commit on an unmoved pointer release, so a vertical swipe can scroll without selecting a challenge. The actual result uses the authored first-challenge aim as a labelled fixture and a trusted Shoot press, followed by real physics.

61/61 unit tests pass, including five pure adapter lifecycle/recovery tests. TypeScript and Vite production build pass. Browser receipts in `local/` and, after release, `production/` distinguish installed Chrome native CDP pinch/touch from Playwright WebKit trusted taps and separately labelled synthetic legacy policy probes. Real result simulation uses an accelerated browser clock; these are functional checks, not performance measurements. Phone 390×844 and tablet 820×1180 are emulated at DPR 1 on an Apple M2 Mac; physical iPhone/iPad Safari remains unverified.

The historical `../touch-zoom-2026-10-21/` evidence describes the earlier narrower release. Existing Git-connected Cloudflare Pages hosting, canonical URL, game physics and assets remain unchanged except for input/CSS code and the explicit recovery UI where needed. Local compiled acceptance passes: installed Chrome 156 native touch/pinch 44/44 checks, Playwright WebKit 27.2 trusted taps and separate legacy probes 19/19 checks, with desktop mouse/keyboard checks included. No page exceptions. Runtime publication and exact canonical-file receipts follow below.

## Published production verification

Runtime `bf7bd2f79f5cbebdb33290b7d90eba5ea934ecaa` was published through the existing Git-connected `bank-it` Pages project from latest remote main `d45f476a2d06cfec3874f6cc36e736309deb40ee`. The automatic production build succeeded: [Cloudflare Pages](https://dash.cloudflare.com/?to=/fa68dcf0ffe51e98df8c91c47b5acf76/pages/view/bank-it/7d6eea73-13d8-46aa-b968-da250c5eb772). At 2026-10-21T03:46:25.708Z, all 13/13 canonical files matched the tested output byte for byte (4,401,403 bytes).

Live installed Chrome passes 50/50 checks and WebKit passes 21/21 checks, including desktop controls. The native Chrome result/intro/pause pinches keep scale 1, injected 1.8 recovery returns to 1 through a real inverse pinch and stays paused, and a current post-Resume TouchMove proves only the original held finger remains. No page exceptions were observed. The final live harness adds stronger held-touch identity/Reset assertions to the earlier local set where their counts differ. [Canonical game](https://bank-it.leotoby.com/). Physical iPad Safari remains unverified.

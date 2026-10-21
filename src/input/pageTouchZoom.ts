// Adapter example: copy into a game, then supply its real play/pause state.
// The lower-level bindGameTouchZoom API is unchanged; isPlaying means that
// browser zoom protection is enabled, not that the simulation is advancing.
import { bindGameTouchZoom } from './gameTouchZoom.ts';

export function installPageTouchZoom({ isActivelyPlaying, pauseGame }: {isActivelyPlaying:()=>boolean;pauseGame:()=>void}) {
  const pageIsEnlarged = () => (window.visualViewport?.scale ?? 1) > 1.01;
  const gameZoom = bindGameTouchZoom({
    surface: window,
    // Cover loading, intro, pause, result and play. An already-enlarged page
    // deliberately admits native gestures so the player can pinch back out.
    isPlaying: () => !document.hidden && !pageIsEnlarged(),
    isGameTarget: target => target instanceof Element && target.ownerDocument === document,
    // Inert menu/background taps are safe to claim too. Mark custom menu
    // controls only after they have pointer activation. Native forms/links stay native.
    isDirectControl: target => target instanceof Element && (
      !!target.closest('canvas, button') ||
      !target.closest('button, a, input, select, textarea, summary, [contenteditable], [role="button"], [role="link"], [role="slider"]')
    ),
  });
  const sync = () => {
    const enlarged = pageIsEnlarged();
    document.documentElement.classList.toggle('page-zoomed', enlarged);
    // pauseGame may itself invoke sync via the game's transition hook. Its
    // synchronous paused state makes that nested call stop instead of recurse.
    if (enlarged && isActivelyPlaying()) pauseGame();
    document.body.classList.toggle('game-playing', !enlarged && isActivelyPlaying());
    // Relatching at scale 1 never resumes the simulation automatically.
  };
  const hidden = () => { if (document.hidden) gameZoom.clear(); };
  document.addEventListener('visibilitychange', hidden);
  window.visualViewport?.addEventListener('resize', sync);
  window.addEventListener('pageshow', sync);
  sync();
  return {
    sync,
    pageIsEnlarged,
    dispose() {
      document.removeEventListener('visibilitychange', hidden);
      window.visualViewport?.removeEventListener('resize', sync);
      window.removeEventListener('pageshow', sync);
      gameZoom.dispose();
    },
  };
}

// Call sync after Start/Resume, pause, Reset and result transitions. Gameplay
// cleanup releases held controls, keys and pending actions, but must NOT call
// gameZoom.clear(): live browser-gesture ownership lasts until the fingers lift.
// Window blur/pagehide and touchcancel are still handled by the low-level guard.

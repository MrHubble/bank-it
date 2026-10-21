// CSS touch-action is the first line of defence. These non-passive Touch/Gesture
// listeners cover Safari's legacy zoom path without consuming Pointer Events or clicks.
interface TouchZoomOptions {
  surface: EventTarget;
  isPlaying: () => boolean;
  isGameTarget: (target: EventTarget | null) => boolean;
  isDirectControl: (target: EventTarget | null) => boolean;
  now?: () => number;
}
export function bindGameTouchZoom({ surface, isPlaying, isGameTarget, isDirectControl, now = () => performance.now() }: TouchZoomOptions) {
  const owned = new Map<number, {target: EventTarget | null; x: number; y: number; t: number; moved: boolean}>(), removers: (() => void)[] = [];
  let multi = false, lastTap: {t: number; x: number; y: number} | null = null;
  const clear = () => { owned.clear(); multi = false; lastTap = null; };
  const listen = (type: string, handler: (event: TouchEvent) => void) => {
    const options = { capture: !['blur', 'pagehide'].includes(type), passive: false };
    const listener = (event: Event) => handler(event as TouchEvent);
    surface.addEventListener(type, listener, options);
    removers.push(() => surface.removeEventListener(type, listener, options));
  };
  const prevent = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  listen('touchstart', event => {
    if (!isPlaying()) { clear(); return; }
    for (const touch of event.changedTouches) {
      if (isGameTarget(touch.target)) owned.set(touch.identifier, {
        target: touch.target, x: touch.clientX, y: touch.clientY, t: now(), moved: false,
      });
    }
    if (event.touches.length > 1 && owned.size) {
      multi = true; lastTap = null; prevent(event);
    }
  });
  listen('touchmove', event => {
    if (!isPlaying()) { clear(); return; }
    for (const touch of event.changedTouches) {
      const start = owned.get(touch.identifier);
      if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 20) start.moved = true;
    }
    if (event.touches.length > 1 && owned.size) { multi = true; lastTap = null; prevent(event); }
  });
  listen('touchend', event => {
    if (!isPlaying()) { clear(); return; }
    for (const touch of event.changedTouches) {
      const start = owned.get(touch.identifier);
      owned.delete(touch.identifier);
      if (!start || multi || start.moved || now() - start.t > 400 || !isDirectControl(start.target)) continue;
      const tap = { t: now(), x: touch.clientX, y: touch.clientY };
      if (lastTap && tap.t - lastTap.t < 350 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 40) prevent(event);
      lastTap = tap;
    }
    const active = new Set(Array.from(event.touches, touch => touch.identifier));
    for (const id of owned.keys()) if (!active.has(id)) owned.delete(id);
    if (!event.touches.length) multi = false;
  });
  listen('touchcancel', clear);
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) listen(type, event => {
    // A real touch sequence distinguishes iPad gestures from a Mac trackpad pinch.
    if (isPlaying() && owned.size) prevent(event);
  });
  for (const type of ['blur', 'pagehide']) listen(type, event => { if (event.target === surface) clear(); });
  return { clear, dispose() { clear(); for (const remove of removers) remove(); } };
}

// One-shot game actions accept any finger, including a second touch while moving.
// Ignore the subsequent pointer-generated click so one press cannot grab AND throw.
export function bindPressAction(element: HTMLElement, action: () => void, options?: AddEventListenerOptions) {
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    action();
  };
  const click = (event: MouseEvent) => {
    // Keyboard and assistive activation still work without pointer events.
    if (event.detail === 0) action();
  };
  element.addEventListener('pointerdown', pointerDown, options);
  element.addEventListener('click', click, options);
  return () => {
    element.removeEventListener('pointerdown', pointerDown);
    element.removeEventListener('click', click);
  };
}

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { bindGameTouchZoom, bindPressAction } from '../src/input/gameTouchZoom.ts';
function setup() {
  const surface = new EventTarget(), control = new EventTarget(), menu = new EventTarget();
  let active = true, clock = 0;
  const policy = bindGameTouchZoom({ surface, isPlaying: () => active, isGameTarget: target => target === control, isDirectControl: target => target === control, now: () => clock });
  const touch = (identifier: number, target = control) => ({ identifier, target, clientX: 10, clientY: 10 });
  type Touch = ReturnType<typeof touch>;
  const send = (type: string, changedTouches: Touch[] = [], touches: Touch[] = []) => {
    const event = new Event(type, { cancelable: true }); Object.assign(event, { changedTouches, touches }); surface.dispatchEvent(event); return event;
  };
  return { surface, menu, touch, send, policy, active: (value: boolean) => active = value, tick: (ms: number) => clock += ms };
}
test('rapid controls and mixed fingers prevent page zoom without swallowing release', () => {
  const t = setup(), a = t.touch(1), b = t.touch(2); let releases = 0;
  t.surface.addEventListener('touchend', () => releases++);
  assert.equal(t.send('touchstart', [a], [a]).defaultPrevented, false); t.send('touchend', [a]); t.tick(100);
  t.send('touchstart', [b], [b]); assert.equal(t.send('touchend', [b]).defaultPrevented, true);
  t.send('touchstart', [a], [a]); assert.equal(t.send('touchstart', [b], [a, b]).defaultPrevented, true);
  assert.equal(t.send('touchmove', [a, b], [a, b]).defaultPrevented, true);
  assert.equal(t.send('gesturestart').defaultPrevented, true); t.send('touchend', [a, b]); assert.equal(releases, 3);
});
test('menus, desktop gestures and cleared/cancelled input retain native defaults', () => {
  const t = setup(), a = t.touch(1), menu = t.touch(2, t.menu);
  assert.equal(t.send('gesturestart').defaultPrevented, false);
  for (const type of ['touchcancel', 'blur', 'pagehide']) { t.send('touchstart', [a], [a]); t.send(type); assert.equal(t.send('gesturechange').defaultPrevented, false); }
  t.active(false); assert.equal(t.send('touchstart', [a, menu], [a, menu]).defaultPrevented, false);
  t.active(true); t.policy.dispose(); assert.equal(t.send('touchstart', [a, menu], [a, menu]).defaultPrevented, false);
});
test('a second-finger HUD press runs once and keyboard activation remains native', () => {
  const button = new EventTarget() as HTMLElement; let count = 0;
  const dispose = bindPressAction(button, () => count++);
  const send = (type: string, properties: object) => { const event = new Event(type, { cancelable: true }); Object.assign(event, properties); button.dispatchEvent(event); return event; };
  assert.equal(send('pointerdown', { button: 0, isPrimary: false, pointerType: 'touch' }).defaultPrevented, true);
  send('click', { detail: 1 }); assert.equal(count, 1); send('click', { detail: 0 }); assert.equal(count, 2);
  dispose(); send('click', { detail: 0 }); assert.equal(count, 2);
});

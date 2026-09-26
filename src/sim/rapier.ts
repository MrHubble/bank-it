import RAPIER from "@dimforge/rapier2d-deterministic-compat";

// The deterministic build of Rapier gives bit-identical results on every
// platform, so recorded challenge solutions replay the same in tests and in
// every browser. The -compat package inlines its WebAssembly, so there is no
// separate .wasm file to serve under the LeoToby base path.

export type Rapier = typeof RAPIER;

let ready: Promise<Rapier> | null = null;

export function loadRapier(): Promise<Rapier> {
  ready ??= RAPIER.init().then(() => RAPIER);
  return ready;
}

import { defineConfig } from "vitest/config";

// `npm run build:leotoby` passes --base=/games/bank-it/ so the build can be
// copied into the LeoToby site. Plain `npm run build` serves from the root.
export default defineConfig({
  build: {
    target: "es2022",
    // Rapier ships its WebAssembly inlined as base64, so the bundle is big.
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
});

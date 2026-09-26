import { defineConfig } from "vitest/config";

// Cloudflare Pages serves this game at the root of bank-it.leotoby.com.
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

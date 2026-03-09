import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      // PolicyAdapter.js dynamically imports a WASM module that may not exist at
      // build time. The import is wrapped in try/catch with a TS fallback, so
      // marking it external is safe — the dynamic import will fail at runtime and
      // the catch block activates the TsFallbackPolicyAdapter.
      external: [/bolt_transfer_policy_wasm/],
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 45,
        branches: 5,
        functions: 31,
        lines: 48,
      },
    },
  },
});

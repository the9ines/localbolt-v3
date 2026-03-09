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

import { defineConfig, type Plugin } from "vite";
import path from "path";
import fs from "fs";

/**
 * Vite plugin: serve .wasm files from node_modules in dev mode.
 *
 * Vite's SPA fallback middleware intercepts requests with Accept: wildcard
 * (including wasm fetches) and returns index.html. This plugin runs
 * before the fallback and serves .wasm files directly with the correct
 * MIME type when they exist on disk.
 *
 * Required for wasm-bindgen packages that use `new URL(..., import.meta.url)`
 * to locate sibling .wasm binaries.
 */
function wasmDevPlugin(): Plugin {
  let root = "";
  return {
    name: "wasm-dev-serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.endsWith(".wasm")) return next();

        const url = req.url.split("?")[0];
        // Try workspace root first (npm workspaces hoist to root node_modules),
        // then fall back to Vite root (packages/localbolt-web).
        const workspaceRoot = path.resolve(root, "../..");
        const candidates = [
          path.join(workspaceRoot, url),
          path.join(root, url),
        ];
        const filePath = candidates.find((p) => fs.existsSync(p));
        if (filePath) {
          res.setHeader("Content-Type", "application/wasm");
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [wasmDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Canonical alias: localbolt uses @the9ines/bolt-transport-web (published npm name).
      // v3 workspace resolves to @the9ines/localbolt-browser (workspace package).
      // This alias lets v3 consume localbolt's canonical source files byte-identical.
      "@the9ines/bolt-transport-web": "@the9ines/localbolt-browser",
    },
  },
  // Exclude localbolt-browser from dep optimization so wasm-bindgen's
  // `new URL(..., import.meta.url)` resolves to the real node_modules path
  // where the .wasm sibling files exist.
  optimizeDeps: {
    exclude: ["@the9ines/localbolt-browser", "@the9ines/bolt-transport-web"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 34,
        branches: 8,
        functions: 22,
        lines: 37,
      },
    },
  },
});

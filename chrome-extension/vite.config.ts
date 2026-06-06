import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

// The CRX plugin wires up the MV3 build (manifest, content scripts, side panel).
// It is skipped under Vitest so unit tests don't try to resolve extension entries.
const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: isTest ? [] : [crx({ manifest })],
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "src/**/*.test.ts"],
    environmentMatchGlobs: [["src/**/*.test.ts", "jsdom"]],
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@runtime": path.resolve(__dirname, "src/runtime"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/i18n/config.ts"],
    },
  },
});

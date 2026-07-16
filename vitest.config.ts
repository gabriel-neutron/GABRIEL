import { mergeConfig, defineConfig } from "vitest/config"
import viteConfig from "./vite.config"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      setupFiles: ["./src/test/setupGeoPackageWasm.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "html"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: [
          "**/*.d.ts",
          "**/*.stories.tsx",
          "src/main.tsx",
          "src/**/*.test.ts",
          "src/**/*.test.tsx",
        ],
        // Baseline matches exercised modules only; raise as more files gain tests (see docs/TIMELINE.md).
        thresholds: {
          lines: 12,
          branches: 9,
          functions: 9,
          statements: 12,
        },
      },
    },
  }),
)

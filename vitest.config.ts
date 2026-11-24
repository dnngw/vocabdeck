import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": resolve("./src"),
            "server-only": resolve("./tests/server-only.ts"),
          },
        },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        resolve: {
          alias: {
            "@": resolve("./src"),
            "server-only": resolve("./tests/server-only.ts"),
          },
        },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});

import { defineConfig, globalIgnores } from "eslint/config";
import next from "@next/eslint-plugin-next";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default defineConfig([
  globalIgnores([
    ".next/**",
    ".cache/**",
    "data/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // Copia íntegra de Sentinel: comprobada por SHA-256, no reformatear su guardián.
    "vendor/sentinel/**",
  ]),
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": next, "react-hooks": hooks },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      ...hooks.configs.recommended.rules,
    },
  },
]);

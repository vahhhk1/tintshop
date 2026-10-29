import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Leading underscore marks intentionally unused bindings (e.g. omitted fields in rest destructuring).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "public/sw.js", "next-env.d.ts", ".pgdata/**"],
  },
];

export default config;

module.exports = {
  extends: ["next/core-web-vitals", "eslint:recommended", "@typescript-eslint/recommended", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn",
    "prefer-const": "error",
    "no-var": "error",
  },
  ignorePatterns: [".next/", "node_modules/", "out/", "dist/", "*.config.js", "*.config.mjs"],
}

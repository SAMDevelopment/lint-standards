import { createConfig } from "./src/eslint/index.mjs";

export default [{ ignores: ["node_modules/**"] }, ...createConfig({ configFiles: [] })];

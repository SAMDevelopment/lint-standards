import tseslint from "typescript-eslint";
import nodePlugin from "eslint-plugin-n";
import testingLibrary from "eslint-plugin-testing-library";
import { plugin } from "./plugin.mjs";

function createConfig(options = {}) {
  const {
    configFiles = [],
    testUtilsFiles = [],
    testUtilsModule,
    testFiles = DEFAULT_TEST_FILES,
    stepdown = {},
  } = options;

  return [
    typescriptParser(),
    productionTypeAssertions(testFiles),
    environmentOnlyInConfig(configFiles),
    testingLibraryImportsOnlyInWrapper(testUtilsFiles),
    strictEquality(),
    testingLibraryRules(testFiles, testUtilsModule),
    ownRules(stepdown),
  ];
}

const DEFAULT_TEST_FILES = ["**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}"];

function typescriptParser() {
  return {
    name: "lint-standards/typescript-parser",
    files: TYPESCRIPT_FILES,
    languageOptions: { parser: tseslint.parser },
  };
}

const TYPESCRIPT_FILES = ["**/*.{ts,tsx,mts,cts}"];

function productionTypeAssertions(testFiles) {
  return {
    name: "lint-standards/type-assertions",
    files: TYPESCRIPT_FILES,
    ignores: testFiles,
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  };
}

function environmentOnlyInConfig(configFiles) {
  return {
    name: "lint-standards/env-only-in-config",
    files: SOURCE_FILES,
    ignores: configFiles,
    plugins: { n: nodePlugin },
    rules: {
      "n/no-process-env": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "Deno",
          property: "env",
          message: "Read environment variables only in the config modules.",
        },
      ],
    },
  };
}

const SOURCE_FILES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];

function testingLibraryImportsOnlyInWrapper(testUtilsFiles) {
  return {
    name: "lint-standards/testing-library-wrapper",
    files: SOURCE_FILES,
    ignores: testUtilsFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@testing-library/react",
              message: "Import from the repo test-utils wrapper instead.",
            },
            {
              name: "@testing-library/user-event",
              message: "Import from the repo test-utils wrapper instead.",
            },
          ],
        },
      ],
    },
  };
}

function strictEquality() {
  return {
    name: "lint-standards/strict-equality",
    files: SOURCE_FILES,
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  };
}

function testingLibraryRules(testFiles, testUtilsModule) {
  return {
    name: "lint-standards/testing-library",
    files: testFiles,
    plugins: { "testing-library": testingLibrary },
    settings: testUtilsModule ? { "testing-library/utils-module": testUtilsModule } : {},
    rules: {
      "testing-library/await-async-events": ["error", { eventModule: "userEvent" }],
      "testing-library/prefer-user-event": "error",
    },
  };
}

function ownRules(stepdown) {
  return {
    name: "lint-standards/own-rules",
    files: SOURCE_FILES,
    plugins: { "lint-standards": plugin },
    rules: {
      "lint-standards/no-comments": "error",
      "lint-standards/stepdown": ["error", stepdown],
    },
  };
}

export { createConfig };

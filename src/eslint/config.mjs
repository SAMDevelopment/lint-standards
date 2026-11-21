import tseslint from "typescript-eslint";
import nodePlugin from "eslint-plugin-n";
import testingLibrary from "eslint-plugin-testing-library";

const SOURCE_FILES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const TYPESCRIPT_FILES = ["**/*.{ts,tsx,mts,cts}"];
const DEFAULT_TEST_FILES = ["**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}"];

export function createConfig(options = {}) {
  const {
    configFiles = [],
    testUtilsFiles = [],
    testUtilsModule,
    testFiles = DEFAULT_TEST_FILES,
  } = options;

  return [
    typescriptParser(),
    productionTypeAssertions(testFiles),
    environmentOnlyInConfig(configFiles),
    testingLibraryImportsOnlyInWrapper(testUtilsFiles),
    testingLibraryRules(testFiles, testUtilsModule),
  ];
}

function typescriptParser() {
  return {
    name: "lint-standards/typescript-parser",
    files: TYPESCRIPT_FILES,
    languageOptions: { parser: tseslint.parser },
  };
}

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
    rules: { "n/no-process-env": "error" },
  };
}

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

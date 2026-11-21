import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import { createConfig } from "../src/eslint/index.mjs";

const options = {
  configFiles: ["src/config/**", "**/vitest.config.ts"],
  testUtilsFiles: ["src/test/test-utils.tsx"],
  testUtilsModule: "test/test-utils",
};

test("type assertions are banned in production but allowed in tests", async () => {
  const production = "const a = value as string;\nconst b = value!;\nconst c = [1] as const;\n";
  assert.deepEqual(await rules("src/a.ts", production), [
    "@typescript-eslint/consistent-type-assertions",
    "@typescript-eslint/no-non-null-assertion",
  ]);
  assert.deepEqual(await rules("src/a.test.ts", production), []);
  assert.deepEqual(await rules("src/a.ts", "const c = [1] as const;\n"), []);
});

test("environment is read only in the configured config files", async () => {
  const code = "export const url = process.env.URL;\n";
  assert.deepEqual(await rules("src/a.ts", code), ["n/no-process-env"]);
  assert.deepEqual(await rules("src/config/server.ts", code), []);
  assert.deepEqual(await rules("vitest.config.ts", code), []);
  assert.deepEqual(await rules("src/a.test.ts", "process.env.URL = 'x';\n"), ["n/no-process-env"]);
});

test("testing library is imported only through the wrapper", async () => {
  const code = "import { render } from '@testing-library/react';\nimport userEvent from '@testing-library/user-event';\nexport { render, userEvent };\n";
  assert.deepEqual(await rules("src/a.test.tsx", code), ["no-restricted-imports", "no-restricted-imports"]);
  assert.deepEqual(await rules("src/test/test-utils.tsx", code), []);
});

test("user-event interactions are awaited and preferred over fireEvent", async () => {
  const unawaited = "import { userEvent } from './test/test-utils';\nit('x', async () => {\n  const user = userEvent.setup();\n  user.click(button);\n});\n";
  assert.deepEqual(await rules("src/a.test.tsx", unawaited), ["testing-library/await-async-events"]);
  const fire = "import { fireEvent } from '@testing-library/react';\nit('x', () => {\n  fireEvent.click(button);\n});\n";
  assert.ok((await rules("src/a.test.tsx", fire)).includes("testing-library/prefer-user-event"));
});

async function rules(filePath, code) {
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: createConfig(options) });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

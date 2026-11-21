import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { noComments } from "../src/eslint/rules/no-comments.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});
const noComment = { messageId: "noComment" };

tester.run("no-comments", noComments, {
  valid: [
    "const a = 1;",
    "// eslint-disable-next-line no-console\nconsole.log(1);",
    "console.log(1); // eslint-disable-line no-console",
    "/* eslint-disable no-console */\nconsole.log(1);\n/* eslint-enable no-console */",
    "// eslint-disable-next-line no-console -- tooling description\nconsole.log(1);",
    "// @ts-expect-error\nconst a: number = 'x';",
    "// @ts-ignore\nconst a: number = 'x';",
    "/* @ts-expect-error */\nconst a: number = 'x';",
    "/*\n * Copyright (c) 2026 Someone\n */\nconst a = 1;",
    "// Copyright 2026 Someone\n// Licensed under the MIT license\nconst a = 1;",
    "#!/usr/bin/env node\n// SPDX-License-Identifier: MIT\nconst a = 1;",
    "// @vitest-environment jsdom\nconst a = 1;",
    "/* @vitest-environment happy-dom */\nconst a = 1;",
    "/** @jest-environment jsdom */\nconst a = 1;",
  ],
  invalid: [
    { code: "// @vitest-environmentish\nconst a = 1;", errors: [noComment] },
    { code: "/** @param x the x */\nconst a = 1;", errors: [noComment] },
    { code: "// hello\nconst a = 1;", errors: [noComment] },
    { code: "const a = 1; // trailing", errors: [noComment] },
    { code: "/* block */\nconst a = 1;", errors: [noComment] },
    { code: "/** Docs for a. */\nconst a = 1;", errors: [noComment] },
    { code: "/**\n * @param x the x\n */\nfunction f(x) {}", errors: [noComment] },
    { code: "// eslint-something-else\nconst a = 1;", errors: [noComment] },
    { code: "// not a directive: @ts-ignore\nconst a = 1;", errors: [noComment] },
    { code: "const a = 1;\n// Copyright 2026 Someone", errors: [noComment] },
    { code: "const a = 1;\n\n// Copyright 2026 Someone\nconst b = 2;", errors: [noComment] },
    { code: "// header\n\nconst a = 1;", errors: [noComment] },
    { code: "// a note\n// Copyright\n\nconst a = 1;\n// eslint-disable-next-line no-console\nconst b = 2; // why", errors: [noComment] },
    {
      code: "const a = <div>{/* note */}</div>;",
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      errors: [noComment],
    },
    { code: "type T = {\n  // field note\n  a: string;\n};", errors: [noComment] },
  ],
});

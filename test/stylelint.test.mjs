import { test } from "node:test";
import assert from "node:assert/strict";
import stylelint from "stylelint";
import defaultConfig, { createStylelintConfig } from "../src/stylelint/index.mjs";

test("margin allows only auto and 0", async () => {
  assert.deepEqual(await lint("a { margin: 0 auto; margin-inline: auto; margin-top: 0; }"), []);
  assert.deepEqual(await lint("a { margin-top: var(--space-2); }"), ["margin-top"]);
  assert.deepEqual(await lint("a { margin: 8px; }"), ["margin"]);
  assert.deepEqual(await lint("a { margin: 0 8px; }"), ["margin"]);
});

test("padding and gap reject raw px and accept tokens and 0", async () => {
  assert.deepEqual(await lint("a { padding: var(--space-2); gap: var(--space-4); padding: 0; }"), []);
  assert.deepEqual(await lint("a { padding: 4px; }"), ["padding"]);
  assert.deepEqual(await lint("a { gap: 8px; row-gap: 2px; }"), ["gap", "row-gap"]);
  assert.deepEqual(await lint("a { padding-inline: calc(var(--space-2) + 4px); }"), ["padding-inline"]);
  assert.deepEqual(await lint("a { width: 4px; height: 12px; }"), []);
});

test("font properties accept only tokens and configured keywords", async () => {
  assert.deepEqual(await lint("a { font-size: var(--font-size-md); font-family: inherit; }"), []);
  assert.deepEqual(await lint("a { font-size: 12px; font-weight: 700; font-family: Arial; }"), [
    "font-size",
    "font-weight",
    "font-family",
  ]);
});

test("color values accept only tokens and configured keywords", async () => {
  assert.deepEqual(await lint("a { color: var(--color-text); background-color: transparent; border-color: currentColor; }"), []);
  assert.deepEqual(await lint("a { color: red; }"), ["color-named", "color"]);
  assert.deepEqual(await lint("a { color: #fff; }"), ["color-no-hex", "color"]);
  assert.deepEqual(await lint("a { background: rgb(0 0 0); }"), ["function-disallowed-list"]);
});

test("allow-lists are configurable", async () => {
  const config = createStylelintConfig({ allowedFontValues: ["inherit", "normal"], allowedColorValues: ["inherit"] });
  assert.deepEqual(await lint("a { font-weight: normal; }", config), []);
  assert.deepEqual(await lint("a { color: transparent; }", config), ["color"]);
});

async function lint(code, config = defaultConfig) {
  const { results } = await stylelint.lint({ code, config });
  return results[0].warnings.map((warning) => warning.text.match(/"([^"]+)" for property "([^"]+)"/)?.[2] ?? warning.rule);
}

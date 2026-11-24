# lint-standards

Shared ESLint and stylelint configuration for TypeScript and React projects. It ships:

- an ESLint plugin (`stepdown`, `no-comments`) and a flat config factory,
- a stylelint config.

There is no build step. Install it as a git dependency pinned to a tag.

## Install

```sh
npm i -D github:SAMDevelopment/lint-standards#v1.0.3
```

Requires ESLint 9 or 10 and TypeScript. Stylelint 16 or later is only needed for the stylelint config. typescript-eslint, eslint-plugin-n and eslint-plugin-testing-library are installed with it. Pin a tag rather than a branch; upgrading means changing the tag.

## ESLint

```js
import { createConfig } from "@samdevelopment/lint-standards";

export default [
  ...createConfig({
    configFiles: ["src/lib/server-config.ts", "src/lib/public-config.ts", "vitest.config.ts"],
    testUtilsFiles: ["src/test/test-utils.tsx"],
    testUtilsModule: "@/test/test-utils",
  }),
];
```

Options (all optional):

| Option | Meaning |
| --- | --- |
| `configFiles` | Globs of the config modules that may read `process.env`. |
| `testUtilsFiles` | Globs of the test-utils wrapper, the only files that may import `@testing-library/react` and `@testing-library/user-event`. |
| `testUtilsModule` | Import path of the wrapper, so eslint-plugin-testing-library recognises its exports. |
| `testFiles` | Globs of test files. Default `**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}`. |
| `stepdown` | Options for the `stepdown` rule (below). |

The package has no per-file exemption lists; `configFiles` and `testUtilsFiles` name where env access and testing-library imports belong.

The plugin is also the default export for use without the factory (`plugins: { "lint-standards": plugin }`).

### Rules

| Rule | Source | What it enforces |
| --- | --- | --- |
| `@typescript-eslint/consistent-type-assertions` (`assertionStyle: never`) | typescript-eslint | No `as` casts in production code. `as const` is allowed. Tests exempt. |
| `@typescript-eslint/no-non-null-assertion` | typescript-eslint | No non-null `!` in production code. Tests exempt. |
| `n/no-process-env` | eslint-plugin-n | `process.env` only in `configFiles`. Also catches assigning to the env in tests. |
| `no-restricted-properties` | ESLint | `Deno.env` (`get`, `toObject`, ...) only in `configFiles`. |
| `no-restricted-imports` | ESLint | `@testing-library/react` and `@testing-library/user-event` only in `testUtilsFiles`. |
| `eqeqeq` (`always`, null ignored) | ESLint | `===` and `!==`, except `== null` / `!= null`. |
| `testing-library/await-async-events` (`eventModule: userEvent`) | eslint-plugin-testing-library | userEvent interactions are awaited. |
| `testing-library/prefer-user-event` | eslint-plugin-testing-library | userEvent instead of fireEvent. |
| `lint-standards/stepdown` | this package | Stepdown order, below. Auto-fixable. |
| `lint-standards/no-comments` | this package | No comments. |

#### `lint-standards/stepdown`

- Main subject first. In a module the subject is the first thing exported (the first export statement); in a test file it is the first `describe`/`it`/`test`.
- Helpers (functions, values, types) follow in first-use order, each just below the code that uses it (depth first).
- A load-time value goes above its first use only where technically required, meaning it is used while the module loads (module-level code, or a `describe` body in a test). Otherwise it goes below, in first-use order. Functions called at load time pull the values they use above too.
- No big block above the subject, types included. At most one type, at most `maxSubjectTypeLines` lines (default 10), may sit above it, and only if the subject uses it (props or signature).
- Exports at the bottom: `export { a, b }`, `export default X`, `export type { T }`. Inline `export` on a declaration is reported and auto-converted. Anonymous default exports are left alone. Next.js route segment config exports (`export const dynamic = ...`) may not accept the list form; set `inlineExports: "allow"` in such repos.
- React order falls out of the above plus one extra: props type, component, helpers, styled components (`styled.x\`\``, `styled(X)\`\``), export.
- Test files: hoisted `vi.mock`/`vi.hoisted`/`jest.mock` go directly after the imports; helpers and fixtures go below the first `describe`.

Options: `testFilePattern` (regex string, default `\.(test|spec)\.[cm]?[jt]sx?$`), `maxSubjectTypeLines`, `inlineExports` (`"forbid"` default, or `"allow"`).

The fix rewrites the whole file layout in one pass and is skipped if it could not keep load-time dependencies valid. It reports without fixing in that case. Run it with a formatter afterwards.

#### `lint-standards/no-comments`

Bans every comment. Allowed: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`, `eslint-enable`, `@ts-expect-error`, `@ts-ignore` comments, test environment pragmas (`// @vitest-environment jsdom`, `@jest-environment`), and a license header at the very top of the file (a leading comment group mentioning copyright, license or SPDX). There is no JSDoc exemption. Text after a directive (`-- reason`) is not policed.

## stylelint

```js
import { createStylelintConfig } from "@samdevelopment/lint-standards/stylelint";

export default createStylelintConfig({
  allowedFontValues: ["inherit", "normal"],
  allowedColorValues: ["inherit", "transparent", "currentColor"],
  tokenFunctions: ["var"],
});
```

Or `{ "extends": ["@samdevelopment/lint-standards/stylelint"] }` for the defaults.

- `margin*`: only `auto` and `0`.
- `padding*`, `gap`, `row-gap`, `column-gap`: no raw `px`. Use tokens (CSS variables).
- `font*`: only token functions (`var(...)`) and the allowed keywords. `font-style` also accepts `normal`, `italic` and `oblique`.
- Colors: `*color` properties accept only token functions and the allowed keywords; hex, named colors and color functions (`rgb`, `hsl`, ...) are banned everywhere.

stylelint only sees plain CSS. For CSS-in-JS (Linaria, styled components) the consuming repo needs a custom syntax such as `postcss-styled-syntax` and must check that interpolated tokens still look like `var(--x)`.

## Limits

Some conventions (naming, reuse, test design, and similar) cannot be checked mechanically and are not covered.

### Not implemented

- `userEvent.setup()` per test: `testing-library/prefer-user-event-setup` exists but only recognises the literal `@testing-library/user-event` import, so it never fires on a test-utils wrapper (which the import ban requires). Left out.
- Raw `rem`/`em` spacing is not banned (only `px`).
- "Small type describing the subject" is approximated: referenced by the subject and within a line limit.

## Development

```sh
npm install
npm test
```

Tests use `node:test`, ESLint's `RuleTester` and `stylelint.lint`. To release: test, commit, then `git tag vX.Y.Z && git push --tags`.

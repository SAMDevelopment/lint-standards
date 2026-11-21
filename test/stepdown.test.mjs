import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { stepdown } from "../src/eslint/rules/stepdown.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});
const testFile = { filename: "src/thing.test.ts" };
const lines = (...parts) => parts.join("\n") + "\n";

tester.run("stepdown: modules", stepdown, {
  valid: [
    lines("import a from 'a';", "", "function main() {", "  return helper();", "}", "", "function helper() {", "  return a;", "}", "", "export { main };"),
    lines(
      "function main() {", "  return first() + second();", "}", "",
      "function first() {", "  return nested();", "}", "",
      "function nested() {", "  return 1;", "}", "",
      "function second() {", "  return 2;", "}", "",
      "export { main };",
    ),
    lines("function main() {", "  return LIMIT;", "}", "", "const LIMIT = 3;", "", "export { main };"),
    lines("type Props = { name: string };", "", "function Hello({ name }: Props) {", "  return name;", "}", "", "export { Hello };"),
    lines("function Hello({ name }: Props) {", "  return name;", "}", "", "type Props = { name: string };", "", "export { Hello };"),
    lines("'use client';", "", "import a from 'a';", "", "function main() {", "  return a;", "}", "", "export default main;"),
    lines("export * from './a';", "export { b } from './b';"),
    lines("export default function () {", "  return 1;", "}"),
    lines("function main(): number;", "function main(value?: number) {", "  return helper(value);", "}", "", "function helper(value?: number) {", "  return value;", "}", "", "export { main };"),
    lines("class Service {", "  run() {", "    return helper();", "  }", "}", "", "function helper() {}", "", "export { Service };"),
    {
      code: lines("export function main() {", "  return helper();", "}", "", "function helper() {}"),
      options: [{ inlineExports: "allow" }],
    },
  ],
  invalid: [
    {
      code: lines("function helper() {", "  return 1;", "}", "", "function main() {", "  return helper();", "}", "", "export { main };"),
      output: lines("function main() {", "  return helper();", "}", "", "function helper() {", "  return 1;", "}", "", "export { main };"),
      errors: [{ messageId: "helperAbove" }],
    },
    {
      code: lines("const LIMIT = 3;", "", "function main() {", "  return LIMIT;", "}", "", "export { main };"),
      output: lines("function main() {", "  return LIMIT;", "}", "", "const LIMIT = 3;", "", "export { main };"),
      errors: [{ messageId: "helperAbove" }],
    },
    {
      code: lines(
        "import a from 'a';", "",
        "function main() {", "  return first() + second();", "}", "",
        "function second() {", "  return 2;", "}", "",
        "function first() {", "  return a;", "}", "",
        "export { main };",
      ),
      output: lines(
        "import a from 'a';", "",
        "function main() {", "  return first() + second();", "}", "",
        "function first() {", "  return a;", "}", "",
        "function second() {", "  return 2;", "}", "",
        "export { main };",
      ),
      errors: [{ messageId: "outOfOrder" }],
    },
    {
      code: lines(
        "function main() {", "  return first() + second();", "}", "",
        "function second() {", "  return 2;", "}", "",
        "function nested() {", "  return 1;", "}", "",
        "function first() {", "  return nested();", "}", "",
        "export { main };",
      ),
      output: lines(
        "function main() {", "  return first() + second();", "}", "",
        "function first() {", "  return nested();", "}", "",
        "function nested() {", "  return 1;", "}", "",
        "function second() {", "  return 2;", "}", "",
        "export { main };",
      ),
      errors: [{ messageId: "outOfOrder" }, { messageId: "outOfOrder" }],
    },
    {
      code: lines(
        "type Options = {", "  a: string;", "  b: string;", "  c: string;", "  d: string;", "  e: string;", "  f: string;", "  g: string;", "  h: string;", "  i: string;", "};", "",
        "function main(options: Options) {", "  return options;", "}", "",
        "export { main };",
      ),
      output: lines(
        "function main(options: Options) {", "  return options;", "}", "",
        "type Options = {", "  a: string;", "  b: string;", "  c: string;", "  d: string;", "  e: string;", "  f: string;", "  g: string;", "  h: string;", "  i: string;", "};", "",
        "export { main };",
      ),
      errors: [{ messageId: "typeAbove" }],
    },
    {
      code: lines(
        "type Other = { a: string };", "type Props = { name: string };", "",
        "function Hello({ name }: Props) {", "  return name + helper();", "}", "",
        "function helper(): Other {", "  return { a: '' };", "}", "",
        "export { Hello };",
      ),
      output: lines(
        "type Props = { name: string };", "",
        "function Hello({ name }: Props) {", "  return name + helper();", "}", "",
        "function helper(): Other {", "  return { a: '' };", "}", "",
        "type Other = { a: string };", "",
        "export { Hello };",
      ),
      errors: [{ messageId: "typeAbove" }],
    },
    {
      code: lines(
        "function main() {", "  return 1;", "}", "",
        "export { main };", "",
        "function other() {", "  return 2;", "}",
      ),
      output: lines(
        "function main() {", "  return 1;", "}", "",
        "function other() {", "  return 2;", "}", "",
        "export { main };",
      ),
      errors: [{ messageId: "exportNotAtBottom" }],
    },
    {
      code: lines("export function main() {", "  return helper();", "}", "", "function helper() {", "  return 1;", "}"),
      output: lines("function main() {", "  return helper();", "}", "", "function helper() {", "  return 1;", "}", "", "export { main };"),
      errors: [{ messageId: "inlineExport" }],
    },
    {
      code: lines("export default function Page() {", "  return 1;", "}"),
      output: lines("function Page() {", "  return 1;", "}", "", "export default Page;"),
      errors: [{ messageId: "inlineExport" }],
    },
    {
      code: lines(
        "export type Props = { a: string };", "",
        "export const main = (props: Props) => helper(props);", "",
        "function helper(props: Props) {", "  return props;", "}",
      ),
      output: lines(
        "type Props = { a: string };", "",
        "const main = (props: Props) => helper(props);", "",
        "function helper(props: Props) {", "  return props;", "}", "",
        "export type { Props };",
        "export { main };",
      ),
      errors: [{ messageId: "inlineExport" }, { messageId: "inlineExport" }],
    },
  ],
});

tester.run("stepdown: React order", stepdown, {
  valid: [
    lines(
      "type Props = { label: string };", "",
      "function Card({ label }: Props) {", "  return <Wrapper>{format(label)}</Wrapper>;", "}", "",
      "function format(label: string) {", "  return label;", "}", "",
      "const Wrapper = styled.div`", "  color: red;", "`;", "",
      "export { Card };",
    ),
    lines(
      "function Card() {", "  return <Wrapper />;", "}", "",
      "const Base = styled.div`", "  color: red;", "`;", "",
      "const Wrapper = styled(Base)`", "  color: blue;", "`;", "",
      "export { Card };",
    ),
  ],
  invalid: [
    {
      code: lines(
        "function Card() {", "  return <Wrapper>{format()}</Wrapper>;", "}", "",
        "const Wrapper = styled.div`", "  color: red;", "`;", "",
        "function format() {", "  return 1;", "}", "",
        "export { Card };",
      ),
      output: lines(
        "function Card() {", "  return <Wrapper>{format()}</Wrapper>;", "}", "",
        "function format() {", "  return 1;", "}", "",
        "const Wrapper = styled.div`", "  color: red;", "`;", "",
        "export { Card };",
      ),
      errors: [{ messageId: "outOfOrder" }],
    },
  ],
});

tester.run("stepdown: load-time values", stepdown, {
  valid: [
    lines("const DEFAULTS = { a: 1 };", "", "const result = build(DEFAULTS);", "", "function build(value) {", "  return value;", "}", "", "export { result };"),
    lines(
      "function main() {", "  return a() + b();", "}", "",
      "function a() {", "  return A;", "}", "",
      "const A = 1;", "",
      "function b() {", "  return B;", "}", "",
      "const B = A + 1;", "",
      "export { main };",
    ),
  ],
  invalid: [
    {
      code: lines(
        "function main() {", "  return a() + b();", "}", "",
        "const A = 1;", "",
        "const B = A + 1;", "",
        "function a() {", "  return A;", "}", "",
        "function b() {", "  return B;", "}", "",
        "export { main };",
      ),
      output: lines(
        "function main() {", "  return a() + b();", "}", "",
        "function a() {", "  return A;", "}", "",
        "const A = 1;", "",
        "function b() {", "  return B;", "}", "",
        "const B = A + 1;", "",
        "export { main };",
      ),
      errors: [{ messageId: "outOfOrder" }],
    },
    {
      code: lines("const base = 2;", "const doubled = base * 2;", "", "function run() {", "  return doubled;", "}", "", "export { run };"),
      output: lines("function run() {", "  return doubled;", "}", "", "const base = 2;", "", "const doubled = base * 2;", "", "export { run };"),
      errors: [{ messageId: "helperAbove" }, { messageId: "helperAbove" }],
    },
  ],
});

tester.run("stepdown: test files", stepdown, {
  valid: [
    {
      ...testFile,
      code: lines(
        "import { vi } from 'vitest';", "import { thing } from './thing';", "",
        "vi.mock('./dep');", "",
        "describe('thing', () => {", "  it('works', () => {", "    expect(build()).toBe(thing);", "  });", "});", "",
        "function build() {", "  return FIXTURE;", "}", "",
        "const FIXTURE = 1;",
      ),
    },
    {
      ...testFile,
      code: lines(
        "import { vi } from 'vitest';", "",
        "const mocks = vi.hoisted(() => ({ a: 1 }));", "",
        "vi.mock('./dep', () => mocks);", "",
        "describe('thing', () => {", "  it('works', () => {});", "});",
      ),
    },
    {
      ...testFile,
      code: lines(
        "const CASES = [1, 2];", "",
        "describe('thing', () => {", "  it.each(CASES)('works %s', () => {});", "});",
      ),
    },
    {
      ...testFile,
      code: lines(
        "const FIXTURE = { a: 1 };", "",
        "describe('thing', () => {", "  const copy = FIXTURE;", "  it('works', () => {", "    expect(copy).toBe(FIXTURE);", "  });", "});",
      ),
    },
  ],
  invalid: [
    {
      ...testFile,
      code: lines(
        "function build() {", "  return 1;", "}", "",
        "describe('thing', () => {", "  it('works', () => {", "    expect(build()).toBe(1);", "  });", "});",
      ),
      output: lines(
        "describe('thing', () => {", "  it('works', () => {", "    expect(build()).toBe(1);", "  });", "});", "",
        "function build() {", "  return 1;", "}",
      ),
      errors: [{ messageId: "helperAbove" }],
    },
    {
      ...testFile,
      code: lines(
        "import { vi } from 'vitest';", "",
        "const value = 1;", "",
        "vi.mock('./dep');", "",
        "describe('thing', () => {", "  it('works', () => {", "    expect(value).toBe(1);", "  });", "});",
      ),
      output: lines(
        "import { vi } from 'vitest';", "",
        "vi.mock('./dep');", "",
        "describe('thing', () => {", "  it('works', () => {", "    expect(value).toBe(1);", "  });", "});", "",
        "const value = 1;",
      ),
      errors: [{ messageId: "helperAbove" }, { messageId: "mockPlacement" }],
    },
    {
      ...testFile,
      code: lines(
        "vi.mock('./dep');", "",
        "import { vi } from 'vitest';", "",
        "describe('thing', () => {", "  it('works', () => {});", "});",
      ),
      output: lines(
        "import { vi } from 'vitest';", "",
        "vi.mock('./dep');", "",
        "describe('thing', () => {", "  it('works', () => {});", "});",
      ),
      errors: [{ messageId: "mockPlacement" }],
    },
  ],
});

tester.run("stepdown: parameters are not exports", stepdown, {
  valid: [],
  invalid: [
    {
      code: lines("export function main(request: string) {", "  return request;", "}"),
      output: lines("function main(request: string) {", "  return request;", "}", "", "export { main };"),
      errors: [{ messageId: "inlineExport" }],
    },
  ],
});

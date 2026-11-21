import { noComments } from "./rules/no-comments.mjs";
import { stepdown } from "./rules/stepdown.mjs";

const plugin = {
  meta: { name: "lint-standards" },
  rules: { "no-comments": noComments, stepdown },
};

export { plugin };

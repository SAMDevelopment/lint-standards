# lint-standards

Shared lint package (ESLint plugin and config, stylelint config) that other repos install as a git dependency pinned to a tag. See README.md for usage and the rule list.

- Rules mirror `citadel/docs/coding-standards`. Do not add a rule that is not in those standards.
- Plain ESM, no build. `npm test` runs everything.
- Every rule has tests (RuleTester or stylelint.lint). Test with ESLint 9 and 10.
- The source follows the standards it enforces: no comments, stepdown order.
- Release by tagging `vX.Y.Z`. Consumers pin the tag; never move a tag.
- No secrets in this repo.

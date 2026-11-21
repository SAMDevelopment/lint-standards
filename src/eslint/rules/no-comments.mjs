const noComments = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Ban all comments. Only tooling directives and a license header at the top of the file are allowed.",
    },
    messages: {
      noComment:
        "Remove this comment. Code says what it does through its names and shape; a reason that needs writing down goes in an ADR.",
    },
    schema: [],
  },
  create(context) {
    return {
      "Program:exit"() {
        const sourceCode = context.sourceCode;
        const comments = sourceCode.getAllComments().filter((comment) => comment.type !== "Shebang");
        const header = licenseHeader(sourceCode, comments);

        for (const comment of comments) {
          if (header.has(comment)) continue;
          if (TOOLING_DIRECTIVE.test(comment.value)) continue;
          context.report({ loc: comment.loc, messageId: "noComment" });
        }
      },
    };
  },
};

function licenseHeader(sourceCode, comments) {
  const firstToken = sourceCode.getFirstToken(sourceCode.ast, { includeComments: false });
  const limit = firstToken ? firstToken.range[0] : Number.POSITIVE_INFINITY;
  const group = [];

  for (const comment of comments) {
    if (comment.range[0] >= limit) break;
    const previous = group.at(-1);
    if (previous && !adjacent(sourceCode, previous, comment)) break;
    if (!previous && !startsFile(sourceCode, comment)) break;
    group.push(comment);
  }

  const text = group.map((comment) => comment.value).join("\n");
  return new Set(LICENSE_HEADER.test(text) ? group : []);
}

function adjacent(sourceCode, previous, comment) {
  const between = sourceCode.text.slice(previous.range[1], comment.range[0]);
  return (between.match(/\n/g) ?? []).length <= 1;
}

function startsFile(sourceCode, comment) {
  const before = sourceCode.text.slice(0, comment.range[0]);
  return before.replace(/^#!.*\n/, "").trim() === "";
}

const LICENSE_HEADER = /copyright|licen[sc]e|SPDX-License-Identifier/i;

const TOOLING_DIRECTIVE =
  /^\s*(eslint-disable(-next-line|-line)?|eslint-enable|@ts-expect-error|@ts-ignore)(\s|$)/;

export { noComments };

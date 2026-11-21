const stepdown = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Main subject first, helpers in first-use order below it, exports at the bottom (stepdown order).",
    },
    fixable: "code",
    messages: {
      helperAbove:
        "Declare `{{name}}` below the main subject. A value goes above it only when it is needed at load time.",
      typeAbove:
        "Declare `{{name}}` below the main subject. Only one small type describing the subject (props or signature) may sit directly above it.",
      outOfOrder:
        "Declare `{{name}}` above `{{previous}}`: helpers follow the main subject in first-use order, and styled components come after the other helpers.",
      inlineExport: "Export `{{name}}` from the bottom of the file instead of inline.",
      exportNotAtBottom: "Move this export to the bottom of the file.",
      mockPlacement: "Hoisted mocks go directly after the imports.",
    },
    schema: [
      {
        type: "object",
        properties: {
          testFilePattern: { type: "string" },
          maxSubjectTypeLines: { type: "integer", minimum: 1 },
          inlineExports: { enum: ["forbid", "allow"] },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = {
      testFilePattern: new RegExp(context.options[0]?.testFilePattern ?? DEFAULT_TEST_FILE_PATTERN),
      maxSubjectTypeLines: context.options[0]?.maxSubjectTypeLines ?? DEFAULT_MAX_SUBJECT_TYPE_LINES,
      inlineExports: context.options[0]?.inlineExports ?? "forbid",
    };
    return {
      "Program:exit"(program) {
        checkProgram(context, program, options);
      },
    };
  },
};

const DEFAULT_TEST_FILE_PATTERN = "\\.(test|spec)\\.[cm]?[jt]sx?$";

const DEFAULT_MAX_SUBJECT_TYPE_LINES = 10;

function checkProgram(context, program, options) {
  const sourceCode = context.sourceCode;
  const isTestFile = options.testFilePattern.test(context.filename);
  const model = buildModel(sourceCode, program, isTestFile, options);
  const plan = planLayout(model, options);
  const violations = findViolations(model, plan, options);
  if (violations.length === 0) return;

  const fix = plan.safe ? (fixer) => rebuild(fixer, program, model, plan) : undefined;
  violations.forEach((violation, index) =>
    context.report({
      node: violation.item.node,
      messageId: violation.messageId,
      data: violation.data,
      fix: index === 0 ? fix : undefined,
    }),
  );
}

function buildModel(sourceCode, program, isTestFile, options) {
  const items = groupStatements(program.body).map((statements, index) =>
    createItem(sourceCode, statements, index, isTestFile),
  );
  const usesByUser = new Map(items.map((item) => [item, []]));

  for (const target of items) {
    for (const variable of target.variables) {
      for (const reference of variable.references) {
        const position = reference.identifier.range[0];
        const user = items.find((item) => position >= item.start && position < item.end);
        if (!user || user === target) continue;
        usesByUser.get(user).push({ target, position, eager: isEagerReference(reference, isTestFile) });
      }
    }
  }
  for (const uses of usesByUser.values()) uses.sort((left, right) => left.position - right.position);

  const model = { sourceCode, items, usesByUser, isTestFile, options };
  model.subject = findSubject(model);
  return model;
}

function groupStatements(body) {
  const groups = [];
  let overloads = [];
  for (const statement of body) {
    const declaration = unwrap(statement);
    if (declaration.type === "TSDeclareFunction" && declaration.id) {
      overloads.push(statement);
      continue;
    }
    const sameFunction =
      overloads.length > 0 &&
      declaration.type === "FunctionDeclaration" &&
      unwrap(overloads[0]).id.name === declaration.id?.name;
    if (sameFunction) {
      groups.push([...overloads, statement]);
    } else {
      overloads.forEach((overload) => groups.push([overload]));
      groups.push([statement]);
    }
    overloads = [];
  }
  overloads.forEach((overload) => groups.push([overload]));
  return groups;
}

function unwrap(statement) {
  const isWrapper =
    (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") &&
    statement.declaration;
  return isWrapper ? statement.declaration : statement;
}

function createItem(sourceCode, statements, index, isTestFile) {
  const node = statements.at(-1);
  const declaration = unwrap(node);
  const kind = classify(node, declaration, isTestFile);
  const scopeManager = sourceCode.scopeManager;
  const variables = ["decl", "type"].includes(kind)
    ? [...new Set(statements.flatMap((statement) => scopeManager.getDeclaredVariables(unwrap(statement))))].filter(
        isModuleVariable,
      )
    : [];
  const first = statements[0];
  const comments = index === 0 ? [] : sourceCode.getCommentsBefore(first);

  return {
    index,
    node,
    statements,
    declaration,
    kind,
    variables,
    names: [...new Set(variables.map((variable) => variable.name))],
    start: comments.length > 0 ? comments[0].range[0] : first.range[0],
    end: node.range[1],
    lines: node.loc.end.line - first.loc.start.line + 1,
    isInlineExport: isInlineExport(node),
  };
}

function classify(statement, declaration, isTestFile) {
  if (statement.type === "ExpressionStatement" && typeof statement.directive === "string") return "directive";
  if (statement.type === "ImportDeclaration" || statement.type === "TSImportEqualsDeclaration") return "import";
  if (isBottomExport(statement)) return "bottomExport";
  if (isTestFile && isPreamble(statement)) return "preamble";
  if (declaration.type === "TSTypeAliasDeclaration" || declaration.type === "TSInterfaceDeclaration") {
    return isNamedDeclaration(declaration) ? "type" : "anchor";
  }
  const isValueDeclaration = [
    "FunctionDeclaration",
    "TSDeclareFunction",
    "ClassDeclaration",
    "VariableDeclaration",
    "TSEnumDeclaration",
  ].includes(declaration.type);
  return isValueDeclaration && isNamedDeclaration(declaration) ? "decl" : "anchor";
}

function isBottomExport(statement) {
  if (statement.type === "ExportAllDeclaration" || statement.type === "TSExportAssignment") return true;
  if (statement.type === "ExportNamedDeclaration") return !statement.declaration;
  return statement.type === "ExportDefaultDeclaration" && statement.declaration.type === "Identifier";
}

function isPreamble(statement) {
  if (statement.type === "ExpressionStatement") return isPreambleCall(statement.expression);
  if (statement.type !== "VariableDeclaration") return false;
  return statement.declarations.every(
    (declarator) => declarator.init && isPreambleCall(stripAwait(declarator.init)),
  );
}

function isPreambleCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    PREAMBLE_ROOTS.has(node.callee.object.name) &&
    node.callee.property.type === "Identifier" &&
    PREAMBLE_METHODS.has(node.callee.property.name)
  );
}

const PREAMBLE_ROOTS = new Set(["vi", "jest"]);

const PREAMBLE_METHODS = new Set(["mock", "unmock", "hoisted"]);

function stripAwait(node) {
  return node.type === "AwaitExpression" ? node.argument : node;
}

function isNamedDeclaration(declaration) {
  return declaration.type === "VariableDeclaration" || Boolean(declaration.id);
}

function isModuleVariable(variable) {
  return variable.scope.type === "module" || variable.scope.type === "global";
}

function isInlineExport(statement) {
  return statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
    ? !isBottomExport(statement)
    : false;
}

function isEagerReference(reference, isTestFile) {
  if (reference.isTypeReference) return false;
  let node = reference.identifier;
  while (node.parent && node.parent.type !== "Program") {
    const parent = node.parent;
    if (parent.type === "TSTypeQuery") return false;
    if (FUNCTION_TYPES.has(parent.type) && !runsDuringModuleEvaluation(parent, isTestFile)) return false;
    if (parent.type === "PropertyDefinition" && !parent.static && parent.value === node) return false;
    node = parent;
  }
  return true;
}

const FUNCTION_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

function runsDuringModuleEvaluation(fn, isTestFile) {
  const call = fn.parent;
  if (call.type !== "CallExpression") return false;
  if (call.callee === fn) return true;
  return isTestFile && DESCRIBE_ROOTS.has(rootCalleeName(call.callee));
}

const DESCRIBE_ROOTS = new Set(["describe", "suite"]);

function rootCalleeName(node) {
  let current = node;
  while (current) {
    if (current.type === "Identifier") return current.name;
    if (current.type === "CallExpression") current = current.callee;
    else if (current.type === "MemberExpression") current = current.object;
    else return undefined;
  }
  return undefined;
}

function findSubject(model) {
  if (model.isTestFile) {
    return model.items.find(
      (item) =>
        item.kind === "anchor" &&
        item.node.type === "ExpressionStatement" &&
        TEST_ROOTS.has(rootCalleeName(item.node.expression)),
    );
  }
  for (const item of model.items) {
    if (item.isInlineExport) return item;
    if (item.kind === "bottomExport") {
      const subject = exportedSubject(model, item);
      if (subject) return subject;
    }
  }
  return model.items.find((item) => item.kind === "anchor" && item.node.type === "ExpressionStatement");
}

const TEST_ROOTS = new Set(["describe", "it", "test", "suite"]);

function exportedSubject(model, exportItem) {
  const statement = exportItem.node;
  const names = [];
  if (statement.type === "ExportDefaultDeclaration") names.push(statement.declaration.name);
  if (statement.type === "ExportNamedDeclaration" && !statement.source) {
    names.push(...statement.specifiers.map((specifier) => specifier.local.name));
  }
  const candidates = names
    .map((name) => model.items.find((item) => item.names.includes(name)))
    .filter(Boolean);
  return candidates.find((item) => item.kind === "decl") ?? candidates[0];
}

function planLayout(model, options) {
  const { items, subject } = model;
  const plan = { safe: false, order: items, pinned: new Set(), smallType: undefined, tail: [] };
  if (!subject) return plan;

  const anchors = items.filter((item) => item.kind === "anchor" && item !== subject);
  plan.pinned = pinnedAbove(model, [subject, ...anchors]);
  plan.smallType = subjectType(model, options);

  const stays = new Set([subject, plan.smallType, ...plan.pinned]);
  const head = items.filter(
    (item) => ["directive", "import", "preamble"].includes(item.kind) || stays.has(item) || (item.kind === "anchor" && item.index < subject.index),
  );
  const fixedHead = head.filter((item) => item !== plan.smallType && item !== subject);
  const headOrder = [
    ...fixedHead.filter((item) => item.kind === "directive"),
    ...fixedHead.filter((item) => item.kind === "import"),
    ...fixedHead.filter((item) => item.kind === "preamble"),
    ...fixedHead.filter((item) => !["directive", "import", "preamble"].includes(item.kind)),
  ];
  const placed = new Set([...headOrder, subject, plan.smallType]);
  const bottom = items.filter((item) => item.kind === "bottomExport");

  plan.tail = tailOrder(model, placed, bottom, [subject, plan.smallType, ...headOrder]);
  plan.order = [...headOrder, ...(plan.smallType ? [plan.smallType] : []), subject, ...plan.tail, ...bottom];
  plan.safe = isSafeOrder(model, plan.order);
  return plan;
}

function pinnedAbove(model, sources) {
  const pinned = new Set();
  const pending = sources.flatMap((source) => eagerDependencies(model, source));
  while (pending.length > 0) {
    const item = pending.pop();
    if (pinned.has(item) || sources.includes(item)) continue;
    pinned.add(item);
    pending.push(...eagerDependencies(model, item));
  }
  return pinned;
}

function eagerDependencies(model, user) {
  const found = new Set();
  const pending = model.usesByUser.get(user).filter((use) => use.eager).map((use) => use.target);
  while (pending.length > 0) {
    const target = pending.pop();
    if (found.has(target)) continue;
    found.add(target);
    if (isCallable(target)) pending.push(...model.usesByUser.get(target).map((use) => use.target));
  }
  return [...found].filter((item) => item !== user && isTemporalDeadZoneSensitive(item));
}

function isCallable(item) {
  const declaration = item.declaration;
  if (["FunctionDeclaration", "TSDeclareFunction", "ClassDeclaration"].includes(declaration.type)) return true;
  if (declaration.type !== "VariableDeclaration") return false;
  return declaration.declarations.some(
    (declarator) => declarator.init && ["ArrowFunctionExpression", "FunctionExpression", "ClassExpression"].includes(declarator.init.type),
  );
}

function isTemporalDeadZoneSensitive(item) {
  return item.kind === "decl" && ["VariableDeclaration", "ClassDeclaration", "TSEnumDeclaration"].includes(item.declaration.type);
}

function subjectType(model, options) {
  const { items, subject, usesByUser } = model;
  if (subject.kind === "type") return undefined;
  const usedBySubject = new Set(usesByUser.get(subject).map((use) => use.target));
  const candidates = items.filter(
    (item) =>
      item.kind === "type" &&
      item.index < subject.index &&
      item.lines <= options.maxSubjectTypeLines &&
      usedBySubject.has(item),
  );
  return candidates.at(-1);
}

function tailOrder(model, placed, bottom, roots) {
  const { items, usesByUser, subject } = model;
  const order = [];
  const seen = new Set(placed);

  const tailAnchors = items.filter((item) => item.kind === "anchor" && item.index > subject.index && !seen.has(item));
  for (const anchor of tailAnchors) {
    seen.add(anchor);
    order.push(anchor);
  }

  const emit = (item) => {
    if (seen.has(item)) return;
    seen.add(item);
    for (const dependency of eagerDependencies(model, item)) emit(dependency);
    order.push(item);
    visit(item);
  };
  const visit = (item) => {
    for (const use of usesByUser.get(item)) {
      if (use.target.kind === "decl" || use.target.kind === "type") emit(use.target);
    }
  };

  [...roots.filter(Boolean), ...tailAnchors, ...bottom].forEach(visit);
  items.filter((item) => item.kind === "decl" || item.kind === "type").forEach(emit);

  return stylesLast(model, order);
}

function stylesLast(model, order) {
  const styled = order.filter(isStyledComponent);
  if (styled.length === 0) return order;
  const candidate = [...order.filter((item) => !styled.includes(item)), ...styled];
  return respectsEagerDependencies(model, candidate) ? candidate : order;
}

function isStyledComponent(item) {
  const declaration = item.declaration;
  if (item.kind !== "decl" || declaration.type !== "VariableDeclaration" || declaration.declarations.length !== 1) return false;
  const init = declaration.declarations[0].init;
  if (!init) return false;
  const expression = init.type === "TaggedTemplateExpression" ? init.tag : init.type === "CallExpression" ? init : undefined;
  return expression !== undefined && rootCalleeName(expression) === "styled";
}

function respectsEagerDependencies(model, order) {
  const positions = new Map(order.map((item, index) => [item, index]));
  return order.every((item) =>
    eagerDependencies(model, item).every(
      (dependency) => !positions.has(dependency) || positions.get(dependency) < positions.get(item),
    ),
  );
}

function isSafeOrder(model, order) {
  if (order.length !== model.items.length || new Set(order).size !== order.length) return false;
  const first = model.items[0];
  if (first.kind === "directive" && order[0] !== first) return false;
  return respectsEagerDependencies(model, order);
}

function findViolations(model, plan, options) {
  const { items, subject } = model;
  const violations = [];
  const add = (item, messageId, data = {}) => violations.push({ item, messageId, data: { name: describeItem(item), ...data } });

  for (const item of items) {
    if (item.kind === "preamble" && misplacedPreamble(items, item)) add(item, "mockPlacement");
    if (item.isInlineExport && item.kind !== "anchor" && options.inlineExports === "forbid") add(item, "inlineExport");
    if (item.kind === "bottomExport" && items.slice(item.index + 1).some((later) => later.kind !== "bottomExport")) {
      add(item, "exportNotAtBottom");
    }
  }
  if (!subject) return violations;

  for (const item of items.slice(0, subject.index)) {
    if (!["decl", "type"].includes(item.kind) || plan.pinned.has(item) || item === plan.smallType) continue;
    add(item, item.kind === "type" ? "typeAbove" : "helperAbove");
  }

  const actual = items.slice(subject.index + 1).filter((item) => plan.tail.includes(item));
  const position = (item) => plan.tail.indexOf(item);
  for (let index = 1; index < actual.length; index += 1) {
    if (position(actual[index]) < position(actual[index - 1])) {
      add(actual[index], "outOfOrder", { previous: describeItem(actual[index - 1]) });
    }
  }
  return violations;
}

function describeItem(item) {
  if (item.names.length > 0) return item.names.join(", ");
  const statement = item.node;
  if (statement.type === "ExpressionStatement") {
    const name = rootCalleeName(statement.expression);
    return name ? `${name}(...)` : "this statement";
  }
  if (isBottomExportOrDefault(statement)) return "this export";
  return "this statement";
}

function isBottomExportOrDefault(statement) {
  return statement.type.startsWith("Export");
}

function misplacedPreamble(items, preamble) {
  return items.some(
    (other) =>
      (other.index < preamble.index && !["directive", "import", "preamble"].includes(other.kind)) ||
      (other.index > preamble.index && other.kind === "import"),
  );
}

function rebuild(fixer, program, model, plan) {
  const { sourceCode, options } = model;
  const generated = [];
  const texts = new Map(model.items.map((item) => [item, itemText(sourceCode, item, generated, options)]));
  const bottomSources = plan.order.filter((item) => item.kind === "bottomExport").map((item) => ({ position: item.start, text: texts.get(item) }));
  const bottomBlock = [...bottomSources, ...generated]
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.text);

  const body = plan.order.filter((item) => item.kind !== "bottomExport");
  const parts = [];
  body.forEach((item, index) => {
    const previous = body[index - 1];
    const separator = index === 0 ? "" : previous.kind === "import" && item.kind === "import" ? "\n" : "\n\n";
    parts.push(separator + texts.get(item));
  });
  bottomBlock.forEach((text, index) => parts.push((index === 0 && body.length > 0 ? "\n\n" : "\n") + text));

  const first = model.items[0];
  const firstStart = first.statements[0].range[0];
  return fixer.replaceTextRange([firstStart, program.body.at(-1).range[1]], parts.join(""));
}

function itemText(sourceCode, item, generated, options) {
  const texts = item.statements.map((statement, index) => {
    const start = index === 0 ? item.start : statement.range[0];
    if (!convertsToBottomExport(item, statement, options)) {
      return sourceCode.text.slice(start, statement.range[1]);
    }
    const declaration = statement.declaration;
    const comments = sourceCode.text.slice(start, statement.range[0]);
    return comments + sourceCode.text.slice(declaration.range[0], statement.range[1]);
  });
  if (convertsToBottomExport(item, item.node, options)) generated.push(bottomExportFor(item));
  return texts.join("\n");
}

function convertsToBottomExport(item, statement, options) {
  return (
    options.inlineExports === "forbid" &&
    item.isInlineExport &&
    item.kind !== "anchor" &&
    isInlineExport(statement) &&
    Boolean(statement.declaration)
  );
}

function bottomExportFor(item) {
  const exported = item.node;
  const names = item.names.join(", ");
  if (exported.type === "ExportDefaultDeclaration") return { position: item.start, text: `export default ${item.names[0]};` };
  const prefix = item.kind === "type" ? "export type" : "export";
  return { position: item.start, text: `${prefix} { ${names} };` };
}

export { stepdown };

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default ?? traverseModule;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceRoots = ["app", "src"].map((entry) =>
  path.join(projectRoot, entry)
);

const pressComponents = new Set([
  "Button",
  "Pressable",
  "TouchableHighlight",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
]);
const pressHandlers = new Set([
  "onLongPress",
  "onPress",
  "onPressIn",
  "onPressOut",
]);

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "_archive" ||
      entry.name.startsWith(".")
    ) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(absolute);
    }
  }
  return files;
}

function location(file, node) {
  return `${path.relative(projectRoot, file)}:${node.loc?.start.line ?? 1}`;
}

function jsxName(node) {
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") {
    return `${jsxName(node.object)}.${jsxName(node.property)}`;
  }
  return "";
}

function attributeName(attribute) {
  return attribute.type === "JSXAttribute" &&
    attribute.name.type === "JSXIdentifier"
    ? attribute.name.name
    : null;
}

function getAttribute(openingElement, name) {
  return openingElement.attributes.find(
    (attribute) => attributeName(attribute) === name
  );
}

function expressionFromAttribute(attribute) {
  if (
    attribute?.type !== "JSXAttribute" ||
    attribute.value?.type !== "JSXExpressionContainer"
  ) {
    return null;
  }
  return attribute.value.expression;
}

function isEmptyHandler(expression) {
  if (!expression) return false;
  if (
    expression.type !== "ArrowFunctionExpression" &&
    expression.type !== "FunctionExpression"
  ) {
    return false;
  }
  if (expression.body.type === "BlockStatement") {
    return expression.body.body.length === 0;
  }
  return ["BooleanLiteral", "NullLiteral"].includes(expression.body.type) ||
    (expression.body.type === "Identifier" && expression.body.name === "undefined");
}

function boundFunctionExpression(nodePath, expression) {
  if (expression?.type !== "Identifier") return expression;
  const binding = nodePath.scope.getBinding(expression.name);
  if (!binding) return expression;

  if (binding.path.isFunctionDeclaration()) return binding.path.node;
  const declarator = binding.path.findParent((candidate) =>
    candidate.isVariableDeclarator()
  );
  const initializer = declarator?.node.init;
  if (
    initializer?.type === "CallExpression" &&
    initializer.arguments[0] &&
    (initializer.arguments[0].type === "ArrowFunctionExpression" ||
      initializer.arguments[0].type === "FunctionExpression")
  ) {
    return initializer.arguments[0];
  }
  return initializer ?? expression;
}

function literalRoutes(node) {
  if (!node) return [];
  if (
    ["ParenthesizedExpression", "TSAsExpression", "TSTypeAssertion"].includes(
      node.type
    )
  ) {
    return literalRoutes(node.expression);
  }
  if (node.type === "StringLiteral") return [node.value];
  if (node.type === "TemplateLiteral") {
    let route = node.quasis[0]?.value.cooked ?? "";
    for (let index = 0; index < node.expressions.length; index += 1) {
      route += `__dynamic__${node.quasis[index + 1]?.value.cooked ?? ""}`;
    }
    return [route];
  }
  if (node.type === "ConditionalExpression") {
    return [
      ...literalRoutes(node.consequent),
      ...literalRoutes(node.alternate),
    ];
  }
  if (node.type === "LogicalExpression") {
    return [...literalRoutes(node.left), ...literalRoutes(node.right)];
  }
  if (node.type !== "ObjectExpression") return [];
  const pathname = node.properties.find(
    (property) =>
      property.type === "ObjectProperty" &&
      ((property.key.type === "Identifier" && property.key.name === "pathname") ||
        (property.key.type === "StringLiteral" && property.key.value === "pathname"))
  );
  return pathname?.type === "ObjectProperty"
    ? literalRoutes(pathname.value)
    : [];
}

function routePattern(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\\\[[^/]+\\\]/g, "[^/]+")}$`);
}

const appRoot = path.join(projectRoot, "app");
const routeFiles = walkFiles(appRoot).filter(
  (file) =>
    !/(^|\/)_(layout|sitemap)\.(?:ts|tsx)$/.test(file) &&
    !path.basename(file).startsWith("+")
);
const routePatterns = routeFiles.flatMap((file) => {
  let route = `/${path
    .relative(appRoot, file)
    .replace(/\.(?:ts|tsx)$/, "")
    .replace(/\/index$/, "")}`;
  if (route === "/index") route = "/";
  const withoutGroups = route.replace(/\/\([^/]+\)/g, "") || "/";
  return [...new Set([route, withoutGroups])].map(routePattern);
});

function routeExists(route) {
  const clean = route.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  return routePatterns.some((pattern) => pattern.test(clean));
}

const errors = [];
let checkedControls = 0;
let checkedRoutes = 0;

for (const file of sourceRoots.flatMap(walkFiles).sort()) {
  const source = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy"],
    });
  } catch (error) {
    errors.push(`${path.relative(projectRoot, file)}: parse failed (${error.message})`);
    continue;
  }

  traverse(ast, {
    JSXOpeningElement(nodePath) {
      const { node } = nodePath;
      const name = jsxName(node.name);
      const onPress = getAttribute(node, "onPress");
      const onPressExpression = boundFunctionExpression(
        nodePath,
        expressionFromAttribute(onPress)
      );

      if (onPress && isEmptyHandler(onPressExpression)) {
        errors.push(`${location(file, node)}: <${name}> has an empty press handler`);
      }

      if (pressComponents.has(name)) {
        checkedControls += 1;
        const hasSpread = node.attributes.some(
          (attribute) => attribute.type === "JSXSpreadAttribute"
        );
        const handler = node.attributes.find((attribute) =>
          pressHandlers.has(attributeName(attribute))
        );
        if (!handler && !hasSpread) {
          errors.push(`${location(file, node)}: <${name}> has no press handler`);
        }

        const disabled = expressionFromAttribute(getAttribute(node, "disabled"));
        if (disabled?.type === "BooleanLiteral" && disabled.value === true) {
          errors.push(`${location(file, node)}: <${name}> is always disabled`);
        }
      }

      if (name === "Switch") {
        checkedControls += 1;
        const hasChangeHandler = Boolean(getAttribute(node, "onValueChange"));
        const isExplicitPreview = Boolean(getAttribute(node, "disabled"));
        if (!hasChangeHandler && !isExplicitPreview) {
          errors.push(`${location(file, node)}: <Switch> has no change handler`);
        }
      }

      if (name === "Link") {
        const hrefAttribute = getAttribute(node, "href");
        const hrefs =
          hrefAttribute?.type === "JSXAttribute" &&
          hrefAttribute.value?.type === "StringLiteral"
            ? [hrefAttribute.value.value]
            : literalRoutes(expressionFromAttribute(hrefAttribute));
        for (const href of hrefs.filter((value) => value.startsWith("/"))) {
          checkedRoutes += 1;
          if (!routeExists(href)) {
            errors.push(`${location(file, node)}: link route does not exist: ${href}`);
          }
        }
      }
    },

    CallExpression(nodePath) {
      const { node } = nodePath;
      if (
        node.callee.type !== "MemberExpression" ||
        node.callee.computed ||
        node.callee.object.type !== "Identifier" ||
        !["navigation", "router"].includes(node.callee.object.name) ||
        node.callee.property.type !== "Identifier" ||
        !["navigate", "push", "replace"].includes(node.callee.property.name)
      ) {
        return;
      }
      const routes = literalRoutes(node.arguments[0]).filter((route) =>
        route.startsWith("/")
      );
      for (const route of routes) {
        checkedRoutes += 1;
        if (!routeExists(route)) {
          errors.push(`${location(file, node)}: navigation route does not exist: ${route}`);
        }
      }
    },
  });
}

if (errors.length > 0) {
  console.error("Interaction check failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Interaction check passed: ${checkedControls} controls have handlers and ${checkedRoutes} static routes resolve.`
);

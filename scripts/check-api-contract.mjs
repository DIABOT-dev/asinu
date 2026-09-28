import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const appRoot = process.cwd();
const backendRoot = path.resolve(appRoot, process.env.ASINU_BACKEND_DIR || '../backend.asinu');
const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);

const walk = (directory, extensions, ignored = new Set()) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target, extensions, ignored));
    else if (extensions.has(path.extname(entry.name))) files.push(target);
  }
  return files;
};

const parse = (file) =>
  ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );

const literal = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;

const renderPath = (node, bindings = new Map(), resolving = new Set()) => {
  if (!node) return null;
  const direct = literal(node);
  if (direct !== null) return direct;
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return renderPath(node.expression, bindings, resolving);
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => ':param' + span.literal.text).join('');
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = renderPath(node.left, bindings, resolving);
    const right = renderPath(node.right, bindings, resolving);
    return left !== null && right !== null ? left + right : null;
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = renderPath(node.whenTrue, bindings, resolving);
    const whenFalse = renderPath(node.whenFalse, bindings, resolving);
    if (whenTrue === null || whenFalse === null) return null;
    return whenTrue.split(/[?#]/, 1)[0] === whenFalse.split(/[?#]/, 1)[0]
      ? whenTrue
      : null;
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.getText() === 'env' &&
    node.name.text === 'apiBaseUrl'
  ) {
    return '';
  }
  if (ts.isCallExpression(node) && node.expression.getText() === 'encodeURIComponent') {
    return ':param';
  }
  if (ts.isIdentifier(node)) {
    if (bindings.has(node.text) && !resolving.has(node.text)) {
      const nextResolving = new Set(resolving).add(node.text);
      return renderPath(bindings.get(node.text), bindings, nextResolving);
    }
    return ':param';
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return ':param';
  }
  return null;
};

const requestMethod = (options) => {
  if (!options || !ts.isObjectLiteralExpression(options)) return options ? '*' : 'GET';
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (property.name.getText().replaceAll(/["']/g, '') !== 'method') continue;
    return (literal(property.initializer) || '*').toUpperCase();
  }
  return 'GET';
};

const normalizePath = (value) => {
  const apiStart = value.indexOf('/api/');
  const appPath = apiStart >= 0 ? value.slice(apiStart) : value;
  const withoutOrigin = appPath.replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split(/[?#]/, 1)[0];
  const normalized = ('/' + withoutQuery).replaceAll(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
};

const frontendRequests = [];
const unresolvedFrontendCalls = [];
const appFiles = walk(
  appRoot,
  new Set(['.ts', '.tsx']),
  new Set(['node_modules', '.expo', 'ios', 'android', 'dist']),
);
for (const file of appFiles) {
  const source = parse(file);
  const bindings = new Map();
  const collectBindings = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(source);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      const isApiClient = callee === 'apiClient';
      const isFetch = callee === 'fetch';
      const isHealthFeedClient = callee === 'healthFeedApi';
      if (isApiClient || isFetch || isHealthFeedClient) {
        let rendered = renderPath(node.arguments[0], bindings);
        const sourceText = node.arguments[0]?.getText(source) || '';
        const isInternalFetch =
          isFetch &&
          (sourceText.includes('apiBase') || rendered?.startsWith('/api/') || false);
        const delegatedHealthFeedCall =
          isApiClient && rendered?.startsWith('/api/health-feed:param');
        if (isHealthFeedClient && rendered) rendered = '/api/health-feed' + rendered;
        if ((isApiClient && !delegatedHealthFeedCall) || isInternalFetch || isHealthFeedClient) {
          const location = `${path.relative(appRoot, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
          if (!rendered || !rendered.includes('/api/')) {
            unresolvedFrontendCalls.push(location);
          } else {
            frontendRequests.push({
              method: requestMethod(node.arguments[1]),
              path: normalizePath(rendered),
              source: location,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const serverFile = path.join(backendRoot, 'server.js');
if (!fs.existsSync(serverFile)) throw new Error(`Backend not found at ${backendRoot}`);
const serverSource = parse(serverFile);
const routeModules = new Map();
const backendRoutes = [];

const addRoute = (method, routePath, source) => {
  backendRoutes.push({ method: method.toUpperCase(), path: normalizePath(routePath), source });
};

const collectRouterRoutes = (file, prefix) => {
  const source = parse(file);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const routePath = literal(node.arguments[0]);
      if (methods.has(method) && routePath !== null) {
        addRoute(method, prefix + routePath, path.relative(backendRoot, file));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
};

const visitServer = (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    if (
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(serverSource) === 'require'
    ) {
      const required = literal(node.initializer.arguments[0]);
      if (required) {
        routeModules.set(
          node.name.text,
          path.resolve(backendRoot, required + (required.endsWith('.js') ? '' : '.js')),
        );
      }
    }
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const owner = node.expression.expression.getText(serverSource);
    const action = node.expression.name.text;
    const routePath = literal(node.arguments[0]);
    if (owner === 'app' && methods.has(action) && routePath !== null) {
      addRoute(action, routePath, 'server.js');
    }
    if (owner === 'app' && action === 'use' && routePath !== null) {
      for (const argument of node.arguments.slice(1)) {
        const routeName = ts.isCallExpression(argument)
          ? argument.expression.getText(serverSource)
          : argument.getText(serverSource);
        const routeFile = routeModules.get(routeName);
        if (routeFile && fs.existsSync(routeFile)) collectRouterRoutes(routeFile, routePath);
      }
    }
  }
  ts.forEachChild(node, visitServer);
};
visitServer(serverSource);

const segments = (value) => value.split('/').filter(Boolean);
const routeMatches = (requestPath, routePath) => {
  const requestSegments = segments(requestPath);
  const routeSegments = segments(routePath);
  if (requestSegments.length !== routeSegments.length) return false;
  return routeSegments.every(
    (segment, index) =>
      segment.startsWith(':') || requestSegments[index] === ':param' || segment === requestSegments[index],
  );
};

const missing = frontendRequests.filter(
  (request) =>
    !backendRoutes.some(
      (route) =>
        (request.method === '*' || request.method === route.method) &&
        routeMatches(request.path, route.path),
    ),
);

const uniqueRequests = new Set(frontendRequests.map(({ method, path: requestPath }) => `${method} ${requestPath}`));
console.log(
  `API contract scan: ${frontendRequests.length} call sites, ${uniqueRequests.size} unique requests, ${backendRoutes.length} backend routes.`,
);
if (unresolvedFrontendCalls.length) {
  console.error('Unresolved internal API calls:');
  unresolvedFrontendCalls.forEach((item) => console.error(`- ${item}`));
}
if (missing.length) {
  console.error('Frontend requests without a matching backend route:');
  missing.forEach((item) => console.error(`- ${item.method} ${item.path} (${item.source})`));
}
if (unresolvedFrontendCalls.length || missing.length) process.exit(1);
console.log('All statically discoverable Asinu app API calls match backend method/path contracts.');

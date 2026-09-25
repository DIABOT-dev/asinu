import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const localesDir = path.join(projectRoot, 'src/i18n/locales');
const sourceRoots = ['app', 'src'].map((entry) => path.join(projectRoot, entry));
const languages = ['vi', 'en'];

const allowedVisibleLiterals = new Set([
  'ASINU',
  'Asinu',
  'Lite',
  'Asinu AI',
  'Google',
  'SOS',
  'Tt',
  'VI',
  'EN',
  'mg/dL',
  'mmHg',
  'ml',
  'kg',
  'đ',
]);

const userFacingAttributes = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'label',
  'message',
  'placeholder',
  'subtitle',
  'title',
]);

const directMessageCalls = new Set(['showToast', 'setPendingToast']);
const directDialogCalls = new Set(['showAlert']);
const userFacingObjectProperties = new Set([
  'body',
  'desc',
  'description',
  'label',
  'message',
  'options',
  'optionsEn',
  'question',
  'questionEn',
  'subtitle',
  'text',
  'title',
]);

const catalogs = new Map();
for (const language of languages) {
  const languageDir = path.join(localesDir, language);
  for (const file of fs.readdirSync(languageDir).filter((entry) => entry.endsWith('.json'))) {
    const namespace = path.basename(file, '.json');
    catalogs.set(
      `${language}:${namespace}`,
      JSON.parse(fs.readFileSync(path.join(languageDir, file), 'utf8')),
    );
  }
}

function getCatalogValue(language, namespace, key) {
  let value = catalogs.get(`${language}:${namespace}`);
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return undefined;
    value = value[segment];
  }
  return value;
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '_archive' || entry.name.startsWith('.')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(absolute);
  }
  return files;
}

function location(file, node) {
  return `${path.relative(projectRoot, file)}:${node.loc?.start.line ?? 1}`;
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function hasReadableCopy(value) {
  const text = normalizeText(value);
  if (!text || allowedVisibleLiterals.has(text)) return false;
  if (/^(?:[a-zA-Z]?g|cm|s|U)$/.test(text)) return false;
  if (/^Inter_\d+(?:Bold|Regular)$/.test(text)) return false;
  return /[A-Za-zÀ-ỹ]/u.test(text);
}

function literalText(node) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((part) => part.value.cooked ?? part.value.raw).join('…');
  }
  return null;
}

function collectRenderedLiterals(node, output = []) {
  if (!node) return output;
  const copy = literalText(node);
  if (copy !== null) {
    output.push({ node, copy });
    return output;
  }
  if (node.type === 'ConditionalExpression') {
    collectRenderedLiterals(node.consequent, output);
    collectRenderedLiterals(node.alternate, output);
  } else if (node.type === 'LogicalExpression') {
    collectRenderedLiterals(node.left, output);
    collectRenderedLiterals(node.right, output);
  } else if (node.type === 'BinaryExpression' && node.operator === '+') {
    collectRenderedLiterals(node.left, output);
    collectRenderedLiterals(node.right, output);
  }
  return output;
}

function translationNamespace(call) {
  const first = call.arguments?.[0];
  if (first?.type === 'StringLiteral') return first.value;
  if (first?.type === 'ArrayExpression') {
    const namespace = first.elements.find((entry) => entry?.type === 'StringLiteral');
    return namespace?.value ?? 'common';
  }
  return 'common';
}

function optionNamespace(options) {
  if (options?.type !== 'ObjectExpression') return null;
  const property = options.properties.find(
    (entry) =>
      entry.type === 'ObjectProperty' &&
      ((entry.key.type === 'Identifier' && entry.key.name === 'ns') ||
        (entry.key.type === 'StringLiteral' && entry.key.value === 'ns')),
  );
  return property?.type === 'ObjectProperty' && property.value.type === 'StringLiteral'
    ? property.value.value
    : null;
}

function hasLiteralDefaultValue(options) {
  if (options?.type !== 'ObjectExpression') return false;
  return options.properties.some(
    (entry) =>
      entry.type === 'ObjectProperty' &&
      ((entry.key.type === 'Identifier' && entry.key.name === 'defaultValue') ||
        (entry.key.type === 'StringLiteral' && entry.key.value === 'defaultValue')) &&
      literalText(entry.value) !== null,
  );
}

const errors = [];
const files = sourceRoots.flatMap(walkFiles).sort();
const globalToastHosts = [];

for (const file of files) {
  // This module is the localized legal-content catalogue itself. Screens must
  // still select the correct language, but its source strings are intentional.
  if (file === path.join(projectRoot, 'src/constants/LegalText.ts')) continue;
  const source = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: false,
    });
  } catch (error) {
    errors.push(`${path.relative(projectRoot, file)}: parse failed (${error.message})`);
    continue;
  }

  const translators = new Map();
  traverse(ast, {
    VariableDeclarator(nodePath) {
      const { node } = nodePath;
      if (
        node.id.type !== 'ObjectPattern' ||
        node.init?.type !== 'CallExpression' ||
        node.init.callee.type !== 'Identifier' ||
        node.init.callee.name !== 'useTranslation'
      ) {
        return;
      }
      const namespace = translationNamespace(node.init);
      for (const property of node.id.properties) {
        if (
          property.type === 'ObjectProperty' &&
          property.key.type === 'Identifier' &&
          property.key.name === 't' &&
          property.value.type === 'Identifier'
        ) {
          translators.set(property.value.name, namespace);
        }
      }
    },
  });

  traverse(ast, {
    CallExpression(nodePath) {
      const { node } = nodePath;
      const calleeName = node.callee.type === 'Identifier' ? node.callee.name : null;

      if (calleeName && translators.has(calleeName)) {
        const keyArgument = node.arguments[0];
        if (keyArgument?.type === 'StringLiteral') {
          let namespace = optionNamespace(node.arguments[1]) ?? translators.get(calleeName);
          let key = keyArgument.value;
          if (key.includes(':')) [namespace, key] = key.split(/:(.*)/s, 2);
          for (const language of languages) {
            if (getCatalogValue(language, namespace, key) === undefined) {
              errors.push(`${location(file, node)}: missing ${language} key ${namespace}:${key}`);
            }
          }
        }
        if (hasLiteralDefaultValue(node.arguments[1])) {
          errors.push(`${location(file, node)}: translated copy must not use a hard-coded defaultValue`);
        }
      }

      if (calleeName && directMessageCalls.has(calleeName)) {
        for (const rendered of collectRenderedLiterals(node.arguments[0])) {
          if (hasReadableCopy(rendered.copy)) {
            errors.push(`${location(file, rendered.node)}: ${calleeName} message must use an i18n key`);
          }
        }
      }

      if (calleeName && directDialogCalls.has(calleeName)) {
        for (const argument of node.arguments.slice(0, 2)) {
          for (const rendered of collectRenderedLiterals(argument)) {
            if (hasReadableCopy(rendered.copy)) {
              errors.push(`${location(file, rendered.node)}: ${calleeName} copy must use an i18n key`);
            }
          }
        }
      }

      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'Alert' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'alert'
      ) {
        for (const argument of node.arguments.slice(0, 2)) {
          for (const rendered of collectRenderedLiterals(argument)) {
            if (hasReadableCopy(rendered.copy)) {
              errors.push(`${location(file, rendered.node)}: Alert.alert copy must use an i18n key`);
            }
          }
        }
      }
    },

    JSXText(nodePath) {
      if (hasReadableCopy(nodePath.node.value)) {
        errors.push(`${location(file, nodePath.node)}: visible JSX text must use an i18n key`);
      }
    },

    JSXAttribute(nodePath) {
      const { node } = nodePath;
      if (node.name.type !== 'JSXIdentifier' || !userFacingAttributes.has(node.name.name)) return;
      const copy = node.value?.type === 'StringLiteral' ? node.value.value : null;
      if (copy !== null && hasReadableCopy(copy)) {
        errors.push(`${location(file, node)}: ${node.name.name} must use an i18n key`);
      }
      if (node.value?.type === 'JSXExpressionContainer') {
        for (const rendered of collectRenderedLiterals(node.value.expression)) {
          if (hasReadableCopy(rendered.copy)) {
            errors.push(`${location(file, rendered.node)}: ${node.name.name} must use an i18n key`);
          }
        }
      }
    },

    JSXExpressionContainer(nodePath) {
      if (nodePath.parentPath?.isJSXAttribute()) return;
      for (const rendered of collectRenderedLiterals(nodePath.node.expression)) {
        if (hasReadableCopy(rendered.copy)) {
          errors.push(`${location(file, rendered.node)}: rendered copy must use an i18n key`);
        }
      }
    },

    ObjectProperty(nodePath) {
      const { node } = nodePath;
      const propertyName =
        node.key.type === 'Identifier'
          ? node.key.name
          : node.key.type === 'StringLiteral'
            ? node.key.value
            : null;
      if (!propertyName || !userFacingObjectProperties.has(propertyName)) return;

      const values = node.value.type === 'ArrayExpression'
        ? node.value.elements.filter(Boolean)
        : [node.value];
      for (const value of values) {
        const copy = literalText(value);
        if (copy !== null && hasReadableCopy(copy)) {
          errors.push(`${location(file, value)}: ${propertyName} copy must use an i18n key`);
        }
      }
    },

    JSXOpeningElement(nodePath) {
      const { node } = nodePath;
      if (node.name.type !== 'JSXIdentifier') return;
      if (node.name.name === 'GlobalToastHost') {
        globalToastHosts.push(location(file, node));
      }
      if (
        node.name.name === 'Toast' &&
        path.relative(projectRoot, file) !== 'src/components/GlobalToastHost.tsx'
      ) {
        errors.push(`${location(file, node)}: Toast must only be rendered by GlobalToastHost`);
      }
    },

    Identifier(nodePath) {
      if (nodePath.node.name === 'ToastAndroid') {
        errors.push(`${location(file, nodePath.node)}: ToastAndroid is forbidden; use the single global toast store`);
      }
    },
  });
}

if (globalToastHosts.length !== 1) {
  errors.push(`expected exactly one GlobalToastHost render, found ${globalToastHosts.length}`);
}

const uniqueErrors = [...new Set(errors)].sort();
if (uniqueErrors.length) {
  console.error(`UI copy check failed (${uniqueErrors.length} issues):`);
  for (const error of uniqueErrors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`UI copy check passed: ${files.length} TypeScript files use valid i18n keys and no direct UI literals.`);
}

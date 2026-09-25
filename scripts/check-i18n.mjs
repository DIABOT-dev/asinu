import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(scriptDir, '../src/i18n/locales');
const languages = ['vi', 'en'];

const flatten = (value, prefix = '') => {
  const result = new Map();
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      for (const [nestedKey, nestedValue] of flatten(child, fullKey)) {
        result.set(nestedKey, nestedValue);
      }
    } else {
      result.set(fullKey, child === null ? 'null' : typeof child);
    }
  }
  return result;
};

const flattenValues = (value, prefix = '') => {
  const result = new Map();
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      for (const [nestedKey, nestedValue] of flattenValues(child, fullKey)) {
        result.set(nestedKey, nestedValue);
      }
    } else {
      result.set(fullKey, child);
    }
  }
  return result;
};

const placeholders = (value) =>
  typeof value === 'string'
    ? [...value.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1]).sort()
    : [];

const errors = [];
const files = fs.readdirSync(path.join(localesDir, 'vi'))
  .filter((file) => file.endsWith('.json'))
  .sort();

for (const file of files) {
  const viPath = path.join(localesDir, 'vi', file);
  const enPath = path.join(localesDir, 'en', file);
  if (!fs.existsSync(enPath)) {
    errors.push(`${file}: missing English catalog`);
    continue;
  }

  let vi;
  let en;
  try {
    vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));
    en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    continue;
  }

  const viKeys = flatten(vi);
  const enKeys = flatten(en);
  const viValues = flattenValues(vi);
  const enValues = flattenValues(en);
  for (const key of new Set([...viKeys.keys(), ...enKeys.keys()])) {
    if (!viKeys.has(key)) errors.push(`${file}: missing Vietnamese key ${key}`);
    if (!enKeys.has(key)) errors.push(`${file}: missing English key ${key}`);
    if (viKeys.has(key) && enKeys.has(key) && viKeys.get(key) !== enKeys.get(key)) {
      errors.push(`${file}: type mismatch for ${key}`);
    }
    if (!viValues.has(key) || !enValues.has(key)) continue;
    if (typeof viValues.get(key) === 'string' && !viValues.get(key).trim()) {
      errors.push(`${file}: empty Vietnamese value for ${key}`);
    }
    if (typeof enValues.get(key) === 'string' && !enValues.get(key).trim()) {
      errors.push(`${file}: empty English value for ${key}`);
    }
    const viParams = placeholders(viValues.get(key));
    const enParams = placeholders(enValues.get(key));
    if (viParams.join('|') !== enParams.join('|')) {
      errors.push(
        `${file}: placeholder mismatch for ${key} (vi=${viParams.join(',')} en=${enParams.join(',')})`,
      );
    }
  }
}

const englishFiles = fs.readdirSync(path.join(localesDir, 'en'))
  .filter((file) => file.endsWith('.json'))
  .sort();
for (const file of englishFiles) {
  if (!files.includes(file)) errors.push(`${file}: missing Vietnamese catalog`);
}

if (errors.length) {
  console.error(`i18n check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`i18n check passed: ${files.length} namespaces, vi/en keys are aligned.`);
}

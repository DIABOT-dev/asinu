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
  for (const key of new Set([...viKeys.keys(), ...enKeys.keys()])) {
    if (!viKeys.has(key)) errors.push(`${file}: missing Vietnamese key ${key}`);
    if (!enKeys.has(key)) errors.push(`${file}: missing English key ${key}`);
    if (viKeys.has(key) && enKeys.has(key) && viKeys.get(key) !== enKeys.get(key)) {
      errors.push(`${file}: type mismatch for ${key}`);
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

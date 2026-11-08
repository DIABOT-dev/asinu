import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Evaluate the production services with an OS-keystore adapter. No network,
// patient data or plaintext disk storage is used by these regression tests.
export function progressHarness() {
  const values = new Map(),
    cache = new Map();
  const secureStore = {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    // eslint-disable-next-line no-new-func -- Exercise the real TS service with the OS keystore replaced.
    new Function('module', 'exports', 'require', code)(module, module.exports, (id) => {
      if (id === 'expo-secure-store') return secureStore;
      if (!id.startsWith('.')) throw new Error(`Unexpected dependency ${id}`);
      return load(path.resolve(path.dirname(file), `${id}.ts`));
    });
    cache.set(file, module.exports);
    return module.exports;
  }
  return {
    progress: load('src/features/checkin/checkin-progress.ts'),
    selection: load('src/features/checkin/triage-answer-selection.ts'),
    values,
  };
}

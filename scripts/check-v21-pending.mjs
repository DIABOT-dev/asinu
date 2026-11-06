import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(
  "src/features/v21/medication.pending.ts",
  "utf8"
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const legacy = new Map(),
  secure = new Map();
let unavailable = false,
  plainWrites = 0;
const storage = {
  getItem: async (k) => legacy.get(k) || null,
  setItem: async (k, v) => {
    plainWrites++;
    legacy.set(k, v);
  },
  removeItem: async (k) => legacy.delete(k),
};
const secrets = {
  getItem: async (k) => secure.get(k) || null,
  setItem: async (k, v) => {
    if (unavailable) throw Error("locked");
    assert.match(k, /^[a-zA-Z0-9_.-]+$/);
    secure.set(k, v);
  },
  removeItem: async (k) => secure.delete(k),
};
const exports = {};
vm.runInNewContext(code, {
  exports,
  require: (name) =>
    name.includes("async-storage")
      ? { __esModule: true, default: storage }
      : name.includes("secureStorage")
      ? { secureStorage: secrets }
      : undefined,
  Promise,
  JSON,
});
const pending = { button: 2, id: "a1111111-1111-4111-8111-111111111111" };
legacy.set("@v21/answer/2/dose", JSON.stringify(pending));
assert.equal(
  JSON.stringify(await exports.loadPendingAnswer("2", "dose")),
  JSON.stringify(pending)
);
assert.equal(legacy.size, 0);
assert.equal(secure.size, 1);
await exports.clearPendingAnswer("2", "dose");
assert.equal(secure.size, 0);
unavailable = true;
await exports.savePendingAnswer("2", "dose", pending);
assert.equal(plainWrites, 0);
assert.equal(legacy.size, 0);
legacy.set("@v21/answer/2/dose", JSON.stringify({ button: 9, id: "invalid" }));
assert.equal(await exports.loadPendingAnswer("2", "dose"), null);
assert.equal(legacy.size, 0);
console.log(
  "PASS pending-answer keychain migration, valid keys, cleanup, malformed input and no plaintext fallback"
);

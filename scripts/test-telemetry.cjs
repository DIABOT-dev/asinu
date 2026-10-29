const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/observability/privacy.ts"),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const policyModule = { exports: {} };
vm.runInThisContext("(function(exports, module) {" + compiled + "\n})")(
  policyModule.exports,
  policyModule
);
const {
  sanitizeEvent,
  apiRoute,
  guardEnvelope,
  createRequestMonitor,
  validRelease,
} = policyModule.exports;
const config = {
  service: "test-frontend",
  environment: "production",
  release: "asinu-doctor-" + "a123456789".repeat(4),
};

test("telemetry removes personal data, secrets, source context and exception text", () => {
  const poison =
    "patient@example.org token-secret health-conversation 0901234567";
  const event = {
    event_id: "test-event",
    level: "error",
    user: { email: poison },
    request: { data: poison, headers: { authorization: poison } },
    extra: { body: poison },
    contexts: { patient: poison },
    breadcrumbs: [{ message: poison }],
    message: poison,
    tags: {
      service: poison,
      user: poison,
      component: "api",
      method: "GET",
      route: "/api/users/0901234567/messages?token=" + poison,
      error_code: poison,
    },
    exception: {
      values: [
        {
          type: "TypeError",
          value: poison,
          stacktrace: {
            frames: [
              {
                filename:
                  "https://app.example/_next/static/chunks/app-abc.js?token=" +
                  poison,
                function: "loadData",
                lineno: 12,
                colno: 4,
                vars: { patient: poison },
                context_line: poison,
              },
            ],
          },
        },
      ],
    },
  };
  const result = sanitizeEvent(event, config);
  assert.equal(JSON.stringify(result).includes(poison), false);
  assert.equal(result.exception.values[0].value, "TypeError");
  assert.deepEqual(
    Object.keys(result.exception.values[0].stacktrace.frames[0]).sort(),
    ["colno", "filename", "function", "lineno"]
  );
  assert.equal(result.tags.service, "test-frontend");
  assert.equal(result.tags.route, "/api/users/:id/messages");
  assert.equal(result.release, config.release);
  assert.equal(result.fingerprint[0], config.service);
  for (const key of ["request", "user", "extra", "contexts", "breadcrumbs"])
    assert.equal(key in result, false);
});
test("source map debug IDs and public script paths survive redaction", () => {
  const id = "12345678-abcd-4321-a123-123456789abc";
  const result = sanitizeEvent(
    {
      exception: { values: [{ type: "Error", value: "private" }] },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            debug_id: id,
            code_file: "https://crm.example/assets/main-abc.js?secret=private",
            private: "private",
          },
        ],
      },
    },
    config
  );
  assert.deepEqual(result.debug_meta.images, [
    {
      type: "sourcemap",
      debug_id: id,
      code_file: "https://crm.example/assets/main-abc.js",
    },
  ]);
  assert.equal(JSON.stringify(result).includes("private"), false);
});
test("tracing, replay and log events cannot leave through the event sanitizer", () => {
  for (const type of ["transaction", "replay_event", "profile", "log"])
    assert.equal(sanitizeEvent({ type }, config), null);
  assert.ok(
    sanitizeEvent(
      { type: "error", exception: { values: [{ type: "Error" }] } },
      config
    )
  );
});
test("envelope guard removes attachments, sessions and sampling context", () => {
  const envelope = [
    { trace: { token: "private" } },
    [
      [{ type: "event" }, { ok: true }],
      [{ type: "attachment" }, "private"],
      [{ type: "session" }, {}],
      [{ type: "replay_recording" }, "private"],
    ],
  ];
  guardEnvelope(envelope);
  assert.deepEqual(envelope, [{}, [[{ type: "event" }, { ok: true }]]]);
});
test("API route labels never contain query strings, names, UUIDs or phone numbers", () => {
  assert.equal(
    apiRoute(
      "https://host.example/api/patients/John-Doe/messages?email=patient@example.org"
    ),
    "/api/patients/:id/messages"
  );
  assert.equal(
    apiRoute("/api/v1/tasks/12345678-abcd-4321-a123-123456789abc"),
    "/api/v1/tasks/:id"
  );
  assert.equal(apiRoute("/api/users/0901234567"), "/api/users/:id");
});
test("request floods are detected once per minute without blocking normal polling", () => {
  const original = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const reports = [];
    const observe = createRequestMonitor((error, tags) =>
      reports.push({ error, tags })
    );
    for (let i = 0; i < 10; i++) observe("/api/doctor/v1/audit");
    assert.equal(reports.length, 0);
    for (let i = 0; i < 100; i++)
      observe("/api/doctor/v1/audit?secret=private");
    assert.equal(reports.length, 1);
    assert.equal(reports[0].error.name, "ExcessiveApiRequestsError");
    assert.equal(reports[0].tags.route, "/api/doctor/v1/audit");
    now += 60_001;
    for (let i = 0; i < 51; i++) observe("/api/doctor/v1/audit");
    assert.equal(reports.length, 2);
  } finally {
    Date.now = original;
  }
});
test("build releases retain hexadecimal SHAs containing long numeric sequences", () => {
  assert.equal(validRelease(config.release), config.release);
  assert.equal(
    validRelease("com.asinu.lite@2.0.2+123"),
    "com.asinu.lite@2.0.2+123"
  );
  assert.equal(validRelease("release with personal text"), undefined);
});

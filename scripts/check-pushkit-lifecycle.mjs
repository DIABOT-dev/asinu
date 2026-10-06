import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const native = fs.readFileSync('ios/Asinu/VoipCallManager.swift', 'utf8');
const appDelegate = fs.readFileSync('ios/Asinu/AppDelegate.swift', 'utf8');
assert.ok(appDelegate.indexOf('VoipCallManager.shared.start()') < appDelegate.indexOf('let factory ='));
const start = native.slice(native.indexOf('  func start()'), native.indexOf('  func registration()'));
assert.ok(start.includes('DispatchQueue.main.sync'));
assert.ok(!start.includes('DispatchQueue.main.async {'));
assert.ok(start.indexOf('_ = provider') < start.indexOf('registry.desiredPushTypes'));
assert.ok(native.includes('endedAttempts[attemptId] = Date()'));
assert.ok(native.includes('configuration.supportsVideo = true'));
console.log('PASS CallKit/PushKit registration precedes React bootstrap; ended identities are retained');

// Execute the actual checked-in Swift handlers with a deferred CallKit adapter.
// No Apple credentials, push tokens, physical calls, or iOS simulator required.
if (process.platform !== 'darwin') {
  console.log('SKIP Swift runtime regressions (macOS/Xcode required); source checks passed');
  process.exit(0);
}
const incoming = native.slice(native.indexOf('  func reportIncoming('), native.indexOf('  private func reportDiscardedVoipPush('));
const discarded = native.slice(native.indexOf('  private func reportDiscardedVoipPush('), native.indexOf('  #if DEBUG\n  func simulateIncoming'));
assert.ok(incoming && discarded && incoming.includes('reportDiscardedVoipPush'));
const harness = `
import Foundation
enum CXCallEndedReason { case remoteEnded }
final class CXHandle {
  enum HandleType { case generic }
  init(type: HandleType, value: String) {}
}
final class CXCallUpdate {
  var remoteHandle: CXHandle?
  var localizedCallerName: String?
  var hasVideo = false
  var supportsDTMF = false
  var supportsHolding = false
  var supportsGrouping = false
  var supportsUngrouping = false
}
final class CXProvider {
  final class Configuration { var ringtoneSound = "" }
  var configuration = Configuration()
  var reports: [UUID] = []
  var updates: [CXCallUpdate] = []
  var ended: [UUID] = []
  var completions: [(Error?) -> Void] = []
  func reportNewIncomingCall(with uuid: UUID, update: CXCallUpdate, completion: @escaping (Error?) -> Void) {
    reports.append(uuid)
    updates.append(update)
    completions.append(completion)
  }
  func reportCall(with uuid: UUID, endedAt: Date, reason: CXCallEndedReason) { ended.append(uuid) }
  func finish(_ error: Error? = nil) {
    completions.removeFirst()(error)
    RunLoop.current.run(until: Date().addingTimeInterval(0.01))
  }
}
final class Handler {
  var provider = CXProvider()
  var callsByUUID: [UUID: [String: String]] = [:]
  var uuidByAttempt: [String: UUID] = [:]
  var endedAttempts: [String: Date] = [:]
  var audioConfigurations = 0
  var ringTimers = 0
  func configureAudioSession() { audioConfigurations += 1 }
  func scheduleRingTimeout(uuid: UUID, attemptId: String, seconds: Int) { ringTimers += 1 }
  func endCall(attemptId: String) {
    guard let uuid = uuidByAttempt[attemptId] else { return }
    provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
    removeCall(uuid: uuid)
  }
  func removeCall(uuid: UUID) {
    guard let call = callsByUUID.removeValue(forKey: uuid), let id = call["attemptId"] else { return }
    uuidByAttempt.removeValue(forKey: id)
    endedAttempts[id] = Date()
  }
  func string(_ value: Any?) -> String {
    if let text = value as? String { return text }
    if let number = value as? NSNumber { return number.stringValue }
    return ""
  }
${incoming}
${discarded}
}
var checks = 0
func test(_ label: String, _ work: () -> Void) { work(); checks += 1; print("PASS \\(label)") }
let payload: [AnyHashable: Any] = ["episodeId": "episode", "attemptId": "attempt", "kind": "INCOMING_CALL", "ringSeconds": 60]
test("a genuine call reports synchronously and completes only after CallKit") {
  let h = Handler(); var done = 0
  h.reportIncoming(payload: payload) { done += 1 }
  assert(h.provider.reports.count == 1 && done == 0 && h.ringTimers == 0)
  assert(h.provider.configuration.ringtoneSound == "asinu_incoming.caf")
  assert(h.provider.updates.last?.hasVideo == true)
  h.provider.finish()
  assert(done == 1 && h.ringTimers == 1 && h.callsByUUID.count == 1)
}
test("visual check-in metadata does not enable number-pad responses or holding") {
  let h = Handler()
  h.reportIncoming(payload: payload) {}; h.provider.finish()
  let update = h.provider.updates.last!
  assert(update.hasVideo && !update.supportsDTMF && !update.supportsHolding)
}
test("urgent calls use the emergency pack without changing CallKit lifecycle") {
  let h = Handler(); var urgent = payload; urgent["severity"] = "URGENT"
  h.reportIncoming(payload: urgent) {}; h.provider.finish()
  assert(h.provider.configuration.ringtoneSound == "asinu_emergency.caf")
  assert(h.ringTimers == 1 && h.callsByUUID.count == 1)
}
for invalid: [AnyHashable: Any] in [
  [:], ["attemptId": "attempt"], ["episodeId": "episode"],
  ["episodeId": "episode", "attemptId": "attempt", "action": "END_CALL"],
  ["episodeId": "episode", "attemptId": "attempt", "kind": "END_CALL"],
  ["episodeId": "episode", "attemptId": "attempt", "kind": "URGENT_REPEAT"],
  ["episodeId": "episode", "attemptId": "attempt", "action": "UNKNOWN"],
] {
  test("obsolete/malformed push owes a report without creating an app call") {
    let h = Handler(); var done = 0
    h.reportIncoming(payload: invalid) { done += 1 }
    assert(h.provider.reports.count == 1 && done == 0)
    assert(h.callsByUUID.isEmpty && h.audioConfigurations == 0)
    assert(h.provider.updates.last?.hasVideo == false)
    h.provider.finish()
    assert(done == 1 && h.provider.ended.count == 1 && h.ringTimers == 0)
  }
}
test("legacy END_CALL closes its own existing call and reports the control push") {
  let h = Handler(); h.reportIncoming(payload: payload) {}; h.provider.finish()
  var done = 0
  h.reportIncoming(payload: ["kind": "END_CALL", "attemptId": "attempt"]) { done += 1 }
  assert(h.callsByUUID.isEmpty && h.provider.reports.count == 2 && done == 0)
  h.provider.finish()
  assert(done == 1 && h.provider.ended.count == 2)
}
test("duplicate push does not replace an answered call or restart its timer") {
  let h = Handler(); h.reportIncoming(payload: payload) {}; h.provider.finish()
  let original = h.uuidByAttempt["attempt"]!
  h.callsByUUID[original]?["nativeAnswered"] = "1"
  var done = 0; h.reportIncoming(payload: payload) { done += 1 }
  assert(h.provider.reports.count == 2 && h.uuidByAttempt["attempt"] == original && done == 0)
  assert(h.provider.updates.last?.hasVideo == false)
  h.provider.finish()
  assert(done == 1 && h.ringTimers == 1 && h.callsByUUID.count == 1 && !h.provider.ended.contains(original))
}
test("CallKit rejection still completes PushKit exactly once and preserves the live call") {
  let h = Handler(); h.reportIncoming(payload: payload) {}; h.provider.finish()
  let original = h.uuidByAttempt["attempt"]!
  var done = 0; h.reportIncoming(payload: payload) { done += 1 }
  h.provider.finish(NSError(domain: "CallKit", code: 3))
  assert(done == 1 && h.uuidByAttempt["attempt"] == original && h.provider.ended.isEmpty)
}
test("an ended attempt cannot ring again after delayed duplicate delivery") {
  let h = Handler(); h.endedAttempts["attempt"] = Date(); var done = 0
  h.reportIncoming(payload: payload) { done += 1 }; h.provider.finish()
  assert(done == 1 && h.callsByUUID.isEmpty && h.ringTimers == 0)
}
test("fast answer before the incoming completion does not re-arm ringing") {
  let h = Handler(); var done = 0
  h.reportIncoming(payload: payload) { done += 1 }
  h.callsByUUID[h.uuidByAttempt["attempt"]!]?["nativeAnswered"] = "1"
  h.provider.finish(); assert(done == 1 && h.ringTimers == 0)
}
test("late completion after a remote end cannot resurrect a call") {
  let h = Handler(); var done = 0
  h.reportIncoming(payload: payload) { done += 1 }; h.endCall(attemptId: "attempt")
  h.provider.finish(); assert(done == 1 && h.ringTimers == 0 && h.callsByUUID.isEmpty)
}
test("CallKit rejecting a genuine incoming call removes pending state") {
  let h = Handler(); var done = 0; h.reportIncoming(payload: payload) { done += 1 }
  h.provider.finish(NSError(domain: "CallKit", code: 1))
  assert(done == 1 && h.callsByUUID.isEmpty && h.uuidByAttempt.isEmpty && h.ringTimers == 0)
}
print("PushKit lifecycle: \\(checks) Swift runtime regression checks passed.")
`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'asinu-pushkit-test-'));
try {
  const source = path.join(temp, 'main.swift');
  fs.writeFileSync(source, harness);
  process.stdout.write(execFileSync('xcrun', ['swift', source], { timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024 }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

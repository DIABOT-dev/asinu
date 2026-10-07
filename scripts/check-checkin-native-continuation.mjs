import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const native = read('ios/Asinu/VoipCallManager.swift');
assert.ok(!/AVAudioPlayer|AVPlayer|AVSpeechSynthesizer|AVSpeechUtterance|playHandoffPrompt/.test(native), 'CallKit must leave spoken guidance to the app');
const duration = native.match(/private let maximumCallDuration: TimeInterval = ([^\n]+)/);
assert.ok(duration);
assert.equal(duration[1].trim(), '10 * 60');
const configuration = native.slice(native.indexOf('  private func configureAudioSession()'), native.indexOf('  private func scheduleCallTimeout('));
assert.ok(configuration.includes('mode: .default'));
assert.ok(configuration.includes('.defaultToSpeaker') && configuration.includes('.allowBluetoothHFP'));
assert.ok(!configuration.includes('overrideOutputAudioPort') && !native.includes('setActive('));
console.log('PASS CallKit has no native spoken reminder; app audio retains speaker/Bluetooth routes');
const foreground = native.slice(native.indexOf('center.addObserver(forName: UIApplication.didBecomeActiveNotification'), native.indexOf('    #if DEBUG'));
assert.ok(foreground.indexOf('self.expireCallsIfNeeded()') >= 0 && foreground.indexOf('self.expireCallsIfNeeded()') < foreground.indexOf('self.pendingCall()'));
console.log('PASS the native 10-minute cap is checked before foreground handoff');

if (process.platform !== 'darwin') {
  console.log('SKIP native Swift runtime checks (macOS required); source checks passed');
  process.exit(0);
}
// Extract checked-in handlers; only Apple framework adapters are mocked.
const method = (start, end) => {
  const from = native.indexOf(start), to = native.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return native.slice(from, to).replace(/private func /g, 'func ');
};
const handlers = [
  method('  func activeCalls()', '  func consumePendingCall()'),
  method('  func pendingCall()', '  func completeAnswer('),
  method('  func completeAnswer(', '  func setCallUIActive('),
  method('  func setCallUIActive(', '  // The self-link'),
  method('  func handleAnsweredCallURL(', '  func reportIncoming('),
  method('  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction)', '  private func openResponseScreen('),
  method('  private func openResponseScreen(', '  func providerDidReset('),
  method('  func providerDidReset(', '  func provider(_ provider: CXProvider, didActivate'),
  method('  func provider(_ provider: CXProvider, didActivate', '  func provider(_ provider: CXProvider, timedOutPerforming'),
  method('  private func configureAudioSession()', '  private func scheduleCallTimeout('),
  method('  private func scheduleCallTimeout(', '  private func removeCall('),
  method('  private func removeCall(', '  private func scheduleRingTimeout('),
].join('\n');
const swift = `
import Foundation
extension Notification.Name {
  static let asinuVoipCallAnswered = Notification.Name("TestAnswered")
  static let asinuVoipCallEnded = Notification.Name("TestEnded")
}
enum CXCallEndedReason { case remoteEnded, failed }
final class CXProvider {
  var ended: [UUID] = []
  var reasons: [CXCallEndedReason] = []
  func reportCall(with uuid: UUID, endedAt: Date, reason: CXCallEndedReason) {
    ended.append(uuid); reasons.append(reason)
  }
}
final class CXEndCallAction {
  let callUUID: UUID
  var fulfilled = false
  init(_ uuid: UUID) { callUUID = uuid }
  func fulfill() { fulfilled = true }
}
final class CXAnswerCallAction {
  let callUUID: UUID
  var fulfilled = false
  var failed = false
  init(_ uuid: UUID = UUID()) { callUUID = uuid }
  func fail() { failed = true }
  func fulfill() { fulfilled = true }
}
final class AVAudioSession {
  enum Category { case playAndRecord }
  enum Mode { case \`default\`, voiceChat }
  struct CategoryOptions: OptionSet {
    let rawValue: Int
    static let allowBluetoothHFP = CategoryOptions(rawValue: 1)
    static let defaultToSpeaker = CategoryOptions(rawValue: 2)
  }
  static let shared = AVAudioSession()
  static func sharedInstance() -> AVAudioSession { shared }
  var configurations = 0
  var mode = Mode.voiceChat
  var options: CategoryOptions = []
  func setCategory(_ category: Category, mode: Mode, options: CategoryOptions) throws {
    configurations += 1
    self.mode = mode
    self.options = options
  }
}
final class UIApplication {
  enum State { case active, background }
  static let shared = UIApplication()
  var applicationState = State.active
  var opened: [URL] = []
  var openSucceeds = true
  func open(_ url: URL, options: [String: Any], completionHandler: ((Bool) -> Void)?) {
    opened.append(url)
    completionHandler?(openSucceeds)
  }
}
final class Handler {
  let pendingCallKey = "asinu.continuation.test." + UUID().uuidString
  let maximumCallDuration: TimeInterval
  var callsByUUID: [UUID: [String: String]] = [:]
  var uuidByAttempt: [String: UUID] = [:]
  var endedAttempts: [String: Date] = [:]
  var answerActionsByUUID: [UUID: CXAnswerCallAction] = [:]
  var answerTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  var responseTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  var responseDeadlinesByUUID: [UUID: String] = [:]
  var callTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  var callDeadlinesByUUID: [UUID: Date] = [:]
  var audioSessionActive = true
  var responseAfterAudioRelease: [String: String]?
  let provider = CXProvider()
  init(maximumCallDuration: TimeInterval = ${duration[1]}) { self.maximumCallDuration = maximumCallDuration }
  func cancelRingTimeout(uuid: UUID) {}
  func seed(answered: Bool = true, accepted: Bool = true, remaining: TimeInterval = 60, lang: String = "vi") -> UUID {
    let uuid = UUID()
    callsByUUID[uuid] = ["episodeId": "episode", "attemptId": "attempt", "nativeAnswered": answered ? "1" : "0", "lang": lang]
    uuidByAttempt["attempt"] = uuid
    scheduleCallTimeout(uuid: uuid)
    UserDefaults.standard.set(callsByUUID[uuid], forKey: pendingCallKey)
    if !accepted { answerActionsByUUID[uuid] = CXAnswerCallAction(uuid) }
    responseDeadlinesByUUID[uuid] = ISO8601DateFormatter().string(from: Date().addingTimeInterval(remaining))
    return uuid
  }
  deinit {
    for timeout in callTimeoutsByUUID.values { timeout.cancel() }
    for timeout in answerTimeoutsByUUID.values { timeout.cancel() }
    for timeout in responseTimeoutsByUUID.values { timeout.cancel() }
    UserDefaults.standard.removeObject(forKey: pendingCallKey)
  }
  ${handlers}
}
var checks = 0
func check(_ label: String, _ body: () -> Void) { body(); checks += 1; print("PASS " + label) }
check("accepted hangup persists a bounded response handoff, fulfills CallKit, and opens app") {
  UIApplication.shared.applicationState = .background
  defer { UIApplication.shared.applicationState = .active }
  let h = Handler(), uuid = h.seed()
  let action = CXEndCallAction(uuid)
  h.provider(h.provider, perform: action)
  assert(action.fulfilled && h.callsByUUID.isEmpty)
  assert(h.pendingCall()?["nativeEnded"] == "1")
  let expiry = Double(h.pendingCall()!["continuationUntil"]!)!
  assert(expiry > Date().timeIntervalSince1970 && expiry <= Date().timeIntervalSince1970 + 60)
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(UIApplication.shared.opened.last?.host == "checkin-call")
  assert(h.handleAnsweredCallURL(UIApplication.shared.opened.last!))
  assert(!h.handleAnsweredCallURL(URL(string: "asinu-lite://checkin-call/wrong?attemptId=attempt&nativeAnswered=1")!))
  UIApplication.shared.applicationState = .active
  assert(!h.setCallUIActive(attemptId: "attempt", active: true, deadline: ""))
  assert(h.pendingCall() == nil)
}
check("CallKit-foregrounded response uses pending recovery without another self-link") {
  UIApplication.shared.applicationState = .active
  let h = Handler(), uuid = h.seed(), before = UIApplication.shared.opened.count
  h.provider(h.provider, perform: CXEndCallAction(uuid))
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(UIApplication.shared.opened.count == before)
  assert(h.pendingCall()?["nativeEnded"] == "1")
}
check("queued screen-open cannot revive a remotely completed call") {
  UIApplication.shared.applicationState = .background
  defer { UIApplication.shared.applicationState = .active }
  let h = Handler(); _ = h.seed()
  let before = UIApplication.shared.opened.count
  h.openResponseScreen(h.pendingCall()!)
  h.endCall(attemptId: "attempt")
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(UIApplication.shared.opened.count == before && h.pendingCall() == nil)
}
check("failed iOS open keeps the bounded handoff for manual unlock/recovery") {
  UIApplication.shared.applicationState = .background
  UIApplication.shared.openSucceeds = false
  defer {
    UIApplication.shared.applicationState = .active
    UIApplication.shared.openSucceeds = true
  }
  let h = Handler(), uuid = h.seed()
  h.provider(h.provider, perform: CXEndCallAction(uuid))
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(h.pendingCall()?["nativeEnded"] == "1")
}
for scenario in ["declined", "accept-pending", "expired"] {
  check(scenario + " call cannot open a response handoff on hangup") {
    let h = Handler(), before = UIApplication.shared.opened.count
    let uuid = h.seed(answered: scenario != "declined", accepted: scenario != "accept-pending", remaining: scenario == "expired" ? -5 : 60)
    h.provider(h.provider, perform: CXEndCallAction(uuid))
    RunLoop.current.run(until: Date().addingTimeInterval(0.02))
    assert(h.pendingCall() == nil && UIApplication.shared.opened.count == before)
  }
}
check("remote completion never opens app and clears an ended continuation") {
  let h = Handler(), uuid = h.seed()
  let before = UIApplication.shared.opened.count
  h.endCall(attemptId: "attempt")
  assert(h.callsByUUID[uuid] == nil && h.pendingCall() == nil && UIApplication.shared.opened.count == before)
  UserDefaults.standard.set(["episodeId": "episode", "attemptId": "attempt", "nativeAnswered": "1", "nativeEnded": "1", "continuationUntil": String(Date().timeIntervalSince1970 + 30)], forKey: h.pendingCallKey)
  h.endCall(attemptId: "attempt")
  assert(h.pendingCall() == nil)
}
check("audio continuation is emitted only after native deactivation, once") {
  let h = Handler(), uuid = h.seed()
  var released = 0
  let observer = NotificationCenter.default.addObserver(forName: .asinuVoipCallAnswered, object: nil, queue: nil) { event in
    if event.userInfo?["audioSessionReleased"] as? String == "1" { released += 1 }
  }
  h.provider(h.provider, perform: CXEndCallAction(uuid))
  assert(released == 0 && h.responseAfterAudioRelease != nil)
  h.provider(h.provider, didDeactivate: AVAudioSession())
  assert(released == 1 && h.responseAfterAudioRelease == nil && !h.audioSessionActive)
  h.provider(h.provider, didDeactivate: AVAudioSession())
  assert(released == 1)
  NotificationCenter.default.removeObserver(observer)
}
check("stale/restarted native calls do not revive without a valid ended-call TTL") {
  let h = Handler()
  for flags in [["nativeAnswered": "1"], ["nativeAnswered": "1", "nativeEnded": "1", "continuationUntil": "bad"], ["nativeAnswered": "1", "nativeEnded": "1", "continuationUntil": "1"]] {
    UserDefaults.standard.set(flags.merging(["attemptId": "attempt", "episodeId": "episode"]) { a, _ in a }, forKey: h.pendingCallKey)
    assert(h.pendingCall() == nil)
  }
}
check("active call snapshot survives consuming the navigation handoff and app audio ownership") {
  let h = Handler(), uuid = h.seed()
  UserDefaults.standard.removeObject(forKey: h.pendingCallKey)
  assert(h.setCallUIActive(attemptId: "attempt", active: true, deadline: ""))
  assert(h.pendingCall() == nil && h.activeCalls() == [h.callsByUUID[uuid]!])
  let snapshot = h.activeCalls()
  h.endCall(attemptId: "attempt")
  assert(h.activeCalls().isEmpty && snapshot.first?["attemptId"] == "attempt")
}
check("answer routes to the app immediately while authenticated acceptance remains pending") {
  UIApplication.shared.applicationState = .background
  defer { UIApplication.shared.applicationState = .active }
  let h = Handler(), uuid = h.seed(answered: false)
  let action = CXAnswerCallAction(uuid)
  var answeredEvents = 0
  let observer = NotificationCenter.default.addObserver(forName: .asinuVoipCallAnswered, object: nil, queue: nil) { event in
    if event.userInfo?["attemptId"] as? String == "attempt" { answeredEvents += 1 }
  }
  defer { NotificationCenter.default.removeObserver(observer) }
  h.provider(h.provider, perform: action)
  assert(!action.fulfilled && !action.failed)
  assert(answeredEvents == 1 && h.pendingCall()?["nativeAnswered"] == "1")
  assert(h.answerActionsByUUID[uuid] === action)
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  let url = UIApplication.shared.opened.last!
  assert(url.host == "checkin-call" && url.path == "/episode")
  assert(h.handleAnsweredCallURL(url))
}
check("foreground answer uses the native event without reopening the app") {
  let h = Handler(), uuid = h.seed(answered: false)
  let before = UIApplication.shared.opened.count
  h.provider(h.provider, perform: CXAnswerCallAction(uuid))
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(UIApplication.shared.opened.count == before)
  assert(h.pendingCall()?["nativeAnswered"] == "1")
}
check("an unknown or closed answer fails without opening a response screen") {
  let h = Handler(), action = CXAnswerCallAction()
  let before = UIApplication.shared.opened.count
  h.provider(h.provider, perform: action)
  assert(action.failed && !action.fulfilled && h.pendingCall() == nil)
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(UIApplication.shared.opened.count == before)
}
check("successful authenticated acceptance fulfills CallKit without extending the hard deadline") {
  let h = Handler(), uuid = h.seed(answered: false)
  let deadline = h.callDeadlinesByUUID[uuid]!, action = CXAnswerCallAction(uuid)
  h.provider(h.provider, perform: action)
  assert(!action.fulfilled)
  h.completeAnswer(attemptId: "attempt", connected: true, deadline: ISO8601DateFormatter().string(from: Date().addingTimeInterval(1800)))
  assert(action.fulfilled && !action.failed)
  assert(h.answerActionsByUUID.isEmpty && h.answerTimeoutsByUUID.isEmpty)
  assert(h.callDeadlinesByUUID[uuid] == deadline && h.responseTimeoutsByUUID[uuid] != nil)
}
check("rejected authenticated acceptance retires the call and all its native timers") {
  let h = Handler(), uuid = h.seed(answered: false)
  let action = CXAnswerCallAction(uuid)
  h.provider(h.provider, perform: action)
  h.completeAnswer(attemptId: "attempt", connected: false, deadline: "")
  assert(action.failed && !action.fulfilled && h.provider.reasons == [.failed])
  assert(h.callsByUUID.isEmpty && h.callTimeoutsByUUID.isEmpty && h.callDeadlinesByUUID.isEmpty)
  assert(h.answerTimeoutsByUUID.isEmpty && h.pendingCall() == nil)
}
check("audio activation only prepares the app session with speaker and Bluetooth routes") {
  let h = Handler(); _ = h.seed()
  let session = AVAudioSession.sharedInstance(), before = session.configurations
  for _ in 0..<3 { h.provider(h.provider, didActivate: session) }
  assert(h.audioSessionActive && session.configurations == before + 3)
  assert(session.mode == .default)
  assert(session.options.contains(.defaultToSpeaker) && session.options.contains(.allowBluetoothHFP))
  h.provider(h.provider, didDeactivate: session)
  assert(!h.audioSessionActive)
}
check("the production timer starts at incoming registration with a ten-minute maximum") {
  let h = Handler(), before = Date(), uuid = h.seed(answered: false)
  assert(h.maximumCallDuration == 600)
  let remaining = h.callDeadlinesByUUID[uuid]!.timeIntervalSince(before)
  assert(remaining >= 600 && remaining < 601 && h.callTimeoutsByUUID[uuid] != nil)
}
check("the native timer closes an accepted call while the user is inside the app") {
  let h = Handler(maximumCallDuration: 0.04), uuid = h.seed()
  let before = UIApplication.shared.opened.count
  var endedEvents = 0
  let observer = NotificationCenter.default.addObserver(forName: .asinuVoipCallEnded, object: nil, queue: nil) { _ in endedEvents += 1 }
  defer { NotificationCenter.default.removeObserver(observer) }
  assert(h.setCallUIActive(attemptId: "attempt", active: true, deadline: ""))
  RunLoop.current.run(until: Date().addingTimeInterval(0.1))
  assert(h.provider.ended == [uuid] && endedEvents == 1)
  assert(h.callsByUUID.isEmpty && h.uuidByAttempt.isEmpty && h.pendingCall() == nil)
  assert(h.callTimeoutsByUUID.isEmpty && h.callDeadlinesByUUID.isEmpty)
  assert(h.responseTimeoutsByUUID.isEmpty && h.responseDeadlinesByUUID.isEmpty)
  assert(UIApplication.shared.opened.count == before && h.responseAfterAudioRelease == nil)
}
check("accepting, refreshing backend deadlines, and changing app state never restart the cap") {
  let h = Handler(maximumCallDuration: 0.06), uuid = h.seed()
  let deadline = h.callDeadlinesByUUID[uuid]!, timeout = h.callTimeoutsByUUID[uuid]!
  let backendDeadline = ISO8601DateFormatter().string(from: Date().addingTimeInterval(1800))
  assert(h.setCallUIActive(attemptId: "attempt", active: true, deadline: backendDeadline))
  UIApplication.shared.applicationState = .background
  assert(h.setCallUIActive(attemptId: "attempt", active: false, deadline: backendDeadline))
  UIApplication.shared.applicationState = .active
  h.provider(h.provider, didActivate: AVAudioSession())
  h.scheduleCallTimeout(uuid: uuid)
  assert(h.callDeadlinesByUUID[uuid] == deadline && h.callTimeoutsByUUID[uuid] === timeout)
  RunLoop.current.run(until: Date().addingTimeInterval(0.12))
  assert(h.provider.ended == [uuid] && h.pendingCall() == nil && h.responseTimeoutsByUUID.isEmpty)
}
check("resume reconciles expired wall-clock deadlines before restoring pending navigation") {
  UIApplication.shared.applicationState = .background
  defer { UIApplication.shared.applicationState = .active }
  let h = Handler(), uuid = h.seed()
  let before = UIApplication.shared.opened.count
  h.openResponseScreen(h.pendingCall()!)
  h.callDeadlinesByUUID[uuid] = Date().addingTimeInterval(-1)
  h.expireCallsIfNeeded()
  RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  assert(h.provider.ended == [uuid] && h.pendingCall() == nil && h.activeCalls().isEmpty)
  assert(UIApplication.shared.opened.count == before)
}
check("an expired call cannot claim audio or resume from a self-link") {
  let h = Handler(), uuid = h.seed()
  h.callDeadlinesByUUID[uuid] = Date().addingTimeInterval(-1)
  assert(!h.setCallUIActive(attemptId: "attempt", active: true, deadline: ""))
  assert(!h.handleAnsweredCallURL(URL(string: "asinu-lite://checkin-call/episode?attemptId=attempt&nativeAnswered=1")!))
  assert(h.provider.ended == [uuid] && h.callTimeoutsByUUID.isEmpty)
}
check("late backend acceptance cannot fulfill an expired CallKit action") {
  let h = Handler(), uuid = h.seed(answered: false)
  let action = CXAnswerCallAction(uuid)
  h.provider(h.provider, perform: action)
  h.callDeadlinesByUUID[uuid] = Date().addingTimeInterval(-1)
  h.completeAnswer(attemptId: "attempt", connected: true, deadline: "")
  assert(action.failed && !action.fulfilled && h.provider.ended == [uuid])
  assert(h.answerActionsByUUID.isEmpty && h.answerTimeoutsByUUID.isEmpty)
}
check("expired hangup closes without creating a new continuation") {
  let h = Handler(), uuid = h.seed()
  h.callDeadlinesByUUID[uuid] = Date().addingTimeInterval(-1)
  let action = CXEndCallAction(uuid)
  h.provider(h.provider, perform: action)
  assert(action.fulfilled && h.pendingCall() == nil && h.responseAfterAudioRelease == nil)
}
check("normal completion cancels the cap and its old work cannot end a newer call") {
  let h = Handler(), first = h.seed(), oldTimeout = h.callTimeoutsByUUID[first]!
  h.endCall(attemptId: "attempt")
  assert(oldTimeout.isCancelled && h.callDeadlinesByUUID.isEmpty)
  let second = h.seed()
  oldTimeout.perform()
  assert(h.provider.ended == [first] && h.callsByUUID[second] != nil)
  assert(h.callTimeoutsByUUID.count == 1 && h.callDeadlinesByUUID.count == 1)
}
check("backend response deadline can still end a call earlier than ten minutes") {
  let h = Handler(), uuid = h.seed()
  let parser = ISO8601DateFormatter()
  parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  h.scheduleResponseTimeout(uuid: uuid, deadline: parser.string(from: Date().addingTimeInterval(0.04)))
  RunLoop.current.run(until: Date().addingTimeInterval(0.1))
  assert(h.provider.ended == [uuid] && h.callTimeoutsByUUID.isEmpty && h.pendingCall() == nil)
}
check("CallKit reset retires every call and timer without resuming guidance") {
  let h = Handler(), uuid = h.seed(answered: false)
  let action = CXAnswerCallAction(uuid)
  h.provider(h.provider, perform: action)
  let timeout = h.callTimeoutsByUUID[uuid]!
  h.providerDidReset(h.provider)
  assert(action.failed && timeout.isCancelled && !h.audioSessionActive)
  assert(h.callsByUUID.isEmpty && h.callTimeoutsByUUID.isEmpty && h.callDeadlinesByUUID.isEmpty)
  assert(h.answerTimeoutsByUUID.isEmpty && h.responseTimeoutsByUUID.isEmpty && h.pendingCall() == nil)
}
print("Native CallKit handoff and timeout: \\(checks) runtime checks passed")
`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asinu-continuation-'));
try {
  const fixture = path.join(directory, 'test.swift');
  fs.writeFileSync(fixture, swift);
  process.stdout.write(execFileSync('swift', [fixture], { encoding: 'utf8', timeout: 60000 }));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

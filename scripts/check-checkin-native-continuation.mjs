import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const native = read('ios/Asinu/VoipCallManager.swift');
assert.ok(!native.includes('AVSpeechSynthesizer') && !native.includes('AVSpeechUtterance'), 'Native prompts must not use Apple speech');
for (const language of ['vi', 'en']) {
  const manifest = JSON.parse(read(`assets/sounds/asinu_checkin_open_app_${language}.json`));
  const audio = fs.readFileSync('assets/sounds/' + manifest.file);
  const text = JSON.parse(read(`locales/${language}.json`)).ios['Localizable.strings'].checkin_call_open_app_prompt;
  assert.equal(manifest.language, language);
  assert.equal(manifest.voice, 'clone_b935a451-7d65-4b73-a083-d46e56c47d4f');
  assert.equal(manifest.text, text);
  assert.equal(manifest.textSha256, createHash('sha256').update(text).digest('hex'));
  assert.equal(manifest.audioSha256, createHash('sha256').update(audio).digest('hex'));
  assert.ok(audio.length > 1000 && audio.length < 2000000);
  assert.ok(read('ios/Asinu.xcodeproj/project.pbxproj').includes(`${manifest.file} in Resources`));
  console.log(`PASS ${language} private Tuấn Anh clone matches localized prompt, audio checksum and Xcode resource`);
  assert.ok(manifest.loudness);
  assert.ok(['ebu-r128-two-pass', 'ebu-r128-dynamic-verified'].includes(manifest.loudness.normalization));
  assert.equal(manifest.loudness.targetIntegratedLufs, -16);
  assert.equal(manifest.loudness.targetTruePeakDbtp, -1.5);
  assert.ok(Math.abs(manifest.loudness.integratedLufs + 16) <= 0.5);
  assert.ok(manifest.loudness.truePeakDbtp <= -1);
}
const configuration = native.slice(native.indexOf('  private func configureAudioSession()'), native.indexOf('  private func playHandoffPromptIfNeeded()'));
assert.ok(configuration.includes('mode: .default'));
assert.ok(configuration.includes('.defaultToSpeaker') && configuration.includes('.allowBluetoothHFP'));
assert.ok(!configuration.includes('overrideOutputAudioPort') && !native.includes('setActive('));
console.log('PASS reminder uses normalized speech, speaker default and no forced route/system volume');

if (process.platform !== 'darwin') {
  console.log('SKIP native Swift runtime checks (macOS required); asset checks passed');
  process.exit(0);
}
// Extract checked-in handlers; only Apple framework adapters are mocked.
const method = (start, end) => {
  const from = native.indexOf(start), to = native.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return native.slice(from, to).replace(/private func /g, 'func ');
};
const handlers = [
  method('  func pendingCall()', '  func completeAnswer('),
  method('  func setCallUIActive(', '  // The self-link'),
  method('  func handleAnsweredCallURL(', '  func reportIncoming('),
  method('  private func openResponseScreen(', '  func providerDidReset('),
  method('  func provider(_ provider: CXProvider, didActivate', '  func provider(_ provider: CXProvider, timedOutPerforming'),
  method('  private func configureAudioSession()', '  private func playHandoffPromptIfNeeded()'),
  method('  private func playHandoffPromptIfNeeded()', '  private func scheduleResponseTimeout('),
  method('  private func removeCall(', '  private func scheduleRingTimeout('),
].join('\n');
const swift = `
import Foundation
extension Notification.Name {
  static let asinuVoipCallAnswered = Notification.Name("TestAnswered")
  static let asinuVoipCallEnded = Notification.Name("TestEnded")
}
enum CXCallEndedReason { case remoteEnded }
final class CXProvider { func reportCall(with: UUID, endedAt: Date, reason: CXCallEndedReason) {} }
final class CXEndCallAction {
  let callUUID: UUID
  var fulfilled = false
  init(_ uuid: UUID) { callUUID = uuid }
  func fulfill() { fulfilled = true }
}
final class CXAnswerCallAction { func fail() {} }
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
final class Bundle {
  static let main = Bundle()
  static var recordingAvailable = true
  init() {}
  init?(path: String) {}
  func path(forResource: String, ofType: String) -> String? { nil }
  func url(forResource: String, withExtension: String) -> URL? { Self.recordingAvailable ? URL(fileURLWithPath: "/" + forResource + "." + withExtension) : nil }
}
func NSLocalizedString(_ key: String, bundle: Bundle, comment: String) -> String { "English guidance" }
final class AVAudioPlayer {
  static var playSucceeds = true
  var isPlaying = false
  var volume: Float = 0.5
  let url: URL
  init(contentsOf: URL) throws { url = contentsOf }
  func prepareToPlay() {}
  func play() -> Bool { isPlaying = Self.playSucceeds; return isPlaying }
  func stop() { isPlaying = false }
}
final class Handler {
  let pendingCallKey = "asinu.continuation.test." + UUID().uuidString
  var callsByUUID: [UUID: [String: String]] = [:]
  var uuidByAttempt: [String: UUID] = [:]
  var endedAttempts: [String: Date] = [:]
  var answerActionsByUUID: [UUID: CXAnswerCallAction] = [:]
  var answerTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  var responseTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  var responseDeadlinesByUUID: [UUID: String] = [:]
  var callUIOwners = Set<UUID>()
  var audioSessionActive = true
  var handoffRecording: AVAudioPlayer?
  var handoffPromptTimer: DispatchWorkItem?
  var responseAfterAudioRelease: [String: String]?
  let provider = CXProvider()
  func cancelRingTimeout(uuid: UUID) {}
  func scheduleResponseTimeout(uuid: UUID, deadline: String) {}
  func seed(answered: Bool = true, accepted: Bool = true, remaining: TimeInterval = 60, lang: String = "vi") -> UUID {
    let uuid = UUID()
    callsByUUID[uuid] = ["episodeId": "episode", "attemptId": "attempt", "nativeAnswered": answered ? "1" : "0", "lang": lang]
    uuidByAttempt["attempt"] = uuid
    UserDefaults.standard.set(callsByUUID[uuid], forKey: pendingCallKey)
    if !accepted { answerActionsByUUID[uuid] = CXAnswerCallAction() }
    responseDeadlinesByUUID[uuid] = ISO8601DateFormatter().string(from: Date().addingTimeInterval(remaining))
    return uuid
  }
  deinit { UserDefaults.standard.removeObject(forKey: pendingCallKey) }
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
check("Vietnamese locked-call prompt plays the private Tuấn Anh clone and releases it on app handoff") {
  let h = Handler(); _ = h.seed()
  h.playHandoffPromptIfNeeded()
  assert(h.handoffRecording?.isPlaying == true)
  assert(h.handoffRecording?.url.lastPathComponent == "asinu_checkin_open_app_vi.mp3")
  assert(h.handoffRecording?.volume == 1)
  let recording = h.handoffRecording!
  h.stopHandoffPrompt()
  assert(!recording.isPlaying && h.handoffRecording == nil && h.handoffPromptTimer == nil)
}
check("CallKit activation configures full-level one-way reminder playback with speaker/headset defaults") {
  let h = Handler(); _ = h.seed(); h.audioSessionActive = false
  let session = AVAudioSession.sharedInstance(), before = session.configurations
  h.provider(h.provider, didActivate: session)
  assert(h.audioSessionActive && session.configurations == before + 1)
  assert(session.mode == .default && session.options.contains(.defaultToSpeaker) && session.options.contains(.allowBluetoothHFP))
  assert(h.handoffRecording?.isPlaying == true && h.handoffRecording?.volume == 1)
  h.stopHandoffPrompt()
}
check("missing/failed recordings never use Apple speech in either locale") {
  for language in ["vi", "en"] {
  let h = Handler(); _ = h.seed(lang: language)
  Bundle.recordingAvailable = false
  h.playHandoffPromptIfNeeded()
  assert(h.handoffRecording == nil && h.handoffPromptTimer == nil)
  Bundle.recordingAvailable = true; AVAudioPlayer.playSucceeds = false
  h.playHandoffPromptIfNeeded()
  assert(h.handoffRecording == nil && h.handoffPromptTimer == nil)
  AVAudioPlayer.playSucceeds = true
  }
}
check("English locked-call guidance also uses the private Tuấn Anh recording") {
  let h = Handler(); _ = h.seed(lang: "en")
  h.playHandoffPromptIfNeeded()
  assert(h.handoffRecording?.isPlaying == true && h.handoffRecording?.volume == 1)
  assert(h.handoffRecording?.url.lastPathComponent == "asinu_checkin_open_app_en.mp3")
  h.stopHandoffPrompt()
}
print("Native continuation and voice: \\(checks) runtime checks passed")
`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asinu-continuation-'));
try {
  const fixture = path.join(directory, 'test.swift');
  fs.writeFileSync(fixture, swift);
  process.stdout.write(execFileSync('swift', [fixture], { encoding: 'utf8', timeout: 60000 }));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

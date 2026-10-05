import AVFAudio
import CallKit
import Foundation
import PushKit
import UIKit

extension Notification.Name {
  static let asinuVoipTokenUpdated = Notification.Name("AsinuVoipTokenUpdated")
  static let asinuVoipCallAnswered = Notification.Name("AsinuVoipCallAnswered")
  static let asinuVoipCallEnded = Notification.Name("AsinuVoipCallEnded")
}

final class VoipCallManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
  static let shared = VoipCallManager()

  private let tokenKey = "asinu.voip.token"
  private let pendingCallKey = "asinu.voip.pendingCall"
  private var pushRegistry: PKPushRegistry?
  private var callsByUUID: [UUID: [String: String]] = [:]
  private var uuidByAttempt: [String: UUID] = [:]
  private var ringTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var answerActionsByUUID: [UUID: CXAnswerCallAction] = [:]
  private var answerTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var responseTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var responseDeadlinesByUUID: [UUID: String] = [:]
  private var callUIOwners = Set<UUID>()
  private var audioSessionActive = false
  private let handoffSpeech = AVSpeechSynthesizer()
  private var handoffPromptTimer: DispatchWorkItem?
  private var applicationObservers: [NSObjectProtocol] = []

  private lazy var provider: CXProvider = {
    let configuration = CXProviderConfiguration()
    configuration.supportsVideo = false
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    configuration.includesCallsInRecents = false
    configuration.ringtoneSound = "asinu_alert.wav"
    let provider = CXProvider(configuration: configuration)
    provider.setDelegate(self, queue: .main)
    return provider
  }()

  var environment: String {
    let configured = Bundle.main.object(forInfoDictionaryKey: "AsinuAPNSEnvironment") as? String
    return configured == "production" ? "production" : "sandbox"
  }

  private override init() {
    super.init()
    handoffSpeech.usesApplicationAudioSession = true
  }

  func start() {
    DispatchQueue.main.async {
      _ = self.provider
      guard self.pushRegistry == nil else { return }
      let registry = PKPushRegistry(queue: .main)
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
      self.pushRegistry = registry
      let center = NotificationCenter.default
      self.applicationObservers = [
        center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
          guard let self else { return }
          for (uuid, call) in self.callsByUUID where call["nativeAnswered"] == "1" {
            self.callUIOwners.remove(uuid)
            UserDefaults.standard.set(call, forKey: self.pendingCallKey)
          }
          // Let the React AppState handler stop its current recording/speech
          // before handing the audio session back to the unlock guidance.
          DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(500)) { [weak self] in
            self?.playHandoffPromptIfNeeded()
          }
        },
        center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
          guard let self, let call = self.pendingCall() else { return }
          NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: call)
        },
      ]

      #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("--asinu-test-callkit") {
        print("[AsinuVoip] Starting CallKit development simulation")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
          self.simulateIncoming(payload: [
            "episodeId": UUID().uuidString.lowercased(),
            "attemptId": UUID().uuidString.lowercased(),
            "kind": "INCOMING_CALL",
            "severity": "URGENT",
          ], completion: {})
        }
      }
      #endif
    }
  }

  func registration() -> [String: String]? {
    guard let token = UserDefaults.standard.string(forKey: tokenKey), !token.isEmpty else { return nil }
    return ["token": token, "environment": environment]
  }

  func consumePendingCall() -> [String: String]? {
    guard let value = pendingCall() else { return nil }
    UserDefaults.standard.removeObject(forKey: pendingCallKey)
    return value
  }

  func pendingCall() -> [String: String]? {
    guard let value = UserDefaults.standard.dictionary(forKey: pendingCallKey) as? [String: String],
          let attemptId = value["attemptId"], let uuid = uuidByAttempt[attemptId],
          callsByUUID[uuid]?["nativeAnswered"] == "1" else {
      UserDefaults.standard.removeObject(forKey: pendingCallKey)
      return nil
    }
    return value
  }

  func completeAnswer(attemptId: String, connected: Bool, deadline: String) {
    guard let uuid = uuidByAttempt[attemptId], let action = answerActionsByUUID.removeValue(forKey: uuid) else { return }
    answerTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    guard connected else {
      action.fail()
      provider.reportCall(with: uuid, endedAt: Date(), reason: .failed)
      removeCall(uuid: uuid)
      return
    }
    // CallKit must not say connected before the authenticated accept succeeds.
    scheduleResponseTimeout(uuid: uuid, deadline: deadline)
    action.fulfill()
  }

  func setCallUIActive(attemptId: String, active: Bool, deadline: String) -> Bool {
    guard let uuid = uuidByAttempt[attemptId], let call = callsByUUID[uuid], call["nativeAnswered"] == "1" else { return false }
    if active && UIApplication.shared.applicationState == .active {
      callUIOwners.insert(uuid)
      stopHandoffPrompt()
      if pendingCall()?["attemptId"] == attemptId {
        UserDefaults.standard.removeObject(forKey: pendingCallKey)
      }
    } else {
      callUIOwners.remove(uuid)
      UserDefaults.standard.set(call, forKey: pendingCallKey)
      playHandoffPromptIfNeeded()
    }
    if !deadline.isEmpty { scheduleResponseTimeout(uuid: uuid, deadline: deadline) }
    // Return whether CallKit owns this call's audio session, even when the
    // phone is locked. Expo must not reconfigure that native session.
    return true
  }

  // The self-link only brings the app forward. Routing has one owner in React,
  // so Expo's URL handler and the native event cannot stack duplicate screens.
  func handleAnsweredCallURL(_ url: URL) -> Bool {
    guard url.scheme == "asinu-lite", url.host == "checkin-call",
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.queryItems?.contains(where: { $0.name == "nativeAnswered" && $0.value == "1" }) == true,
          let attemptId = components.queryItems?.first(where: { $0.name == "attemptId" })?.value,
          let uuid = uuidByAttempt[attemptId], let call = callsByUUID[uuid],
          call["nativeAnswered"] == "1", url.path == "/" + (call["episodeId"] ?? "") else { return false }
    UserDefaults.standard.set(call, forKey: pendingCallKey)
    NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: call)
    return true
  }

  func endCall(attemptId: String, reason: CXCallEndedReason = .remoteEnded) {
    guard let uuid = uuidByAttempt[attemptId] else { return }
    provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
    removeCall(uuid: uuid)
  }

  func reportIncoming(payload: [AnyHashable: Any], completion: @escaping () -> Void) {
    let action = string(payload["action"])
    let kind = string(payload["kind"])
    let attemptId = string(payload["attemptId"])

    if action == "END_CALL" || kind == "END_CALL" {
      if !attemptId.isEmpty { endCall(attemptId: attemptId) }
      completion()
      return
    }

    let episodeId = string(payload["episodeId"])
    guard !episodeId.isEmpty, !attemptId.isEmpty else {
      completion()
      return
    }

    // URGENT_REPEAT uses the same attempt. Do not stack duplicate CallKit UIs
    // while the current call is still ringing or connected.
    if uuidByAttempt[attemptId] != nil {
      completion()
      return
    }

    let uuid = UUID()
    let severity = string(payload["severity"])
    let localizedTitle = string(payload["title"])
    let configuredRingSeconds = Int(string(payload["ringSeconds"])) ?? 60
    let ringSeconds = min(max(configuredRingSeconds, 30), 180)
    let call = [
      "episodeId": episodeId,
      "attemptId": attemptId,
      "severity": severity,
      "kind": kind,
      "ringSeconds": String(ringSeconds),
      "lang": string(payload["lang"]) == "en" ? "en" : "vi",
    ]
    callsByUUID[uuid] = call
    uuidByAttempt[attemptId] = uuid

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(
      type: .generic,
      value: NSLocalizedString("checkin_call_handle", comment: "CallKit check-in handle")
    )
    update.localizedCallerName = localizedTitle.isEmpty
      ? NSLocalizedString("checkin_call_title", comment: "CallKit check-in title")
      : localizedTitle
    update.hasVideo = false
    update.supportsDTMF = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false

    configureAudioSession()
    provider.reportNewIncomingCall(with: uuid, update: update) { error in
      DispatchQueue.main.async {
        #if DEBUG
        if let error { print("[AsinuVoip] CallKit report failed: \(error.localizedDescription)") }
        else { print("[AsinuVoip] CallKit incoming call reported") }
        #endif
        if error != nil {
          self.removeCall(uuid: uuid)
        } else if let current = self.callsByUUID[uuid], current["nativeAnswered"] != "1" {
          // A very fast answer may precede this completion callback. Never
          // re-arm its ringing timer after acceptance or after the call ended.
          self.scheduleRingTimeout(uuid: uuid, attemptId: attemptId, seconds: ringSeconds)
        }
        completion()
      }
    }
  }

  #if DEBUG
  func simulateIncoming(payload: [AnyHashable: Any], completion: @escaping () -> Void) {
    var value = payload
    if value["episodeId"] == nil { value["episodeId"] = UUID().uuidString.lowercased() }
    if value["attemptId"] == nil { value["attemptId"] = UUID().uuidString.lowercased() }
    if value["kind"] == nil { value["kind"] = "INCOMING_CALL" }
    if value["severity"] == nil { value["severity"] = "UNKNOWN" }
    reportIncoming(payload: value, completion: completion)
  }
  #endif

  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    guard type == .voIP else { return }
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(token, forKey: tokenKey)
    NotificationCenter.default.post(
      name: .asinuVoipTokenUpdated,
      object: nil,
      userInfo: ["token": token, "environment": environment]
    )
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else { return }
    UserDefaults.standard.removeObject(forKey: tokenKey)
    NotificationCenter.default.post(
      name: .asinuVoipTokenUpdated,
      object: nil,
      userInfo: ["token": NSNull(), "environment": environment]
    )
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    reportIncoming(payload: payload.dictionaryPayload, completion: completion)
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard var call = callsByUUID[action.callUUID] else {
      action.fail()
      return
    }

    cancelRingTimeout(uuid: action.callUUID)
    configureAudioSession()
    call["nativeAnswered"] = "1"
    callsByUUID[action.callUUID] = call
    answerActionsByUUID[action.callUUID] = action
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, let pending = self.answerActionsByUUID.removeValue(forKey: action.callUUID) else { return }
      pending.fail()
      self.provider.reportCall(with: action.callUUID, endedAt: Date(), reason: .failed)
      self.removeCall(uuid: action.callUUID)
    }
    answerTimeoutsByUUID[action.callUUID] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
    UserDefaults.standard.set(call, forKey: pendingCallKey)
    NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: call)

    let episodeId = call["episodeId"] ?? ""
    let attemptId = call["attemptId"] ?? ""
    var components = URLComponents()
    components.scheme = "asinu-lite"
    components.host = "checkin-call"
    components.path = "/" + episodeId
    components.queryItems = [
      URLQueryItem(name: "attemptId", value: attemptId),
      URLQueryItem(name: "nativeAnswered", value: "1"),
    ]
    if let url = components.url {
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
      }
    }
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    removeCall(uuid: action.callUUID)
    action.fulfill()
  }

  func providerDidReset(_ provider: CXProvider) {
    for uuid in Array(callsByUUID.keys) { removeCall(uuid: uuid) }
    audioSessionActive = false
    stopHandoffPrompt()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    audioSessionActive = true
    playHandoffPromptIfNeeded()
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    audioSessionActive = false
    stopHandoffPrompt()
  }

  func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) {
    guard let callAction = action as? CXCallAction else { return }
    removeCall(uuid: callAction.callUUID)
  }

  private func configureAudioSession() {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .defaultToSpeaker])
    } catch {
      // Do not activate manually: CallKit owns audio-session activation.
    }
  }

  private func playHandoffPromptIfNeeded() {
    guard audioSessionActive,
          let entry = callsByUUID.first(where: { $0.value["nativeAnswered"] == "1" && !callUIOwners.contains($0.key) }),
          answerActionsByUUID[entry.key] == nil else { return }
    if handoffSpeech.isSpeaking || handoffPromptTimer != nil { return }
    let language = entry.value["lang"] == "en" ? "en" : "vi"
    let bundle = Bundle.main.path(forResource: language, ofType: "lproj").flatMap { Bundle(path: $0) } ?? Bundle.main
    let utterance = AVSpeechUtterance(string: NSLocalizedString("checkin_call_open_app_prompt", bundle: bundle, comment: "Open Asinu to respond to an answered call"))
    utterance.voice = AVSpeechSynthesisVoice(language: language == "en" ? "en-US" : "vi-VN")
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.85
    handoffSpeech.speak(utterance)
    // A bounded reminder, only during this accepted call. Never synthesize
    // medical conclusions, create a check-in, or send family confirmation here.
    let reminder = DispatchWorkItem { [weak self] in
      self?.handoffPromptTimer = nil
      self?.playHandoffPromptIfNeeded()
    }
    handoffPromptTimer = reminder
    DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: reminder)
  }

  private func stopHandoffPrompt() {
    handoffPromptTimer?.cancel()
    handoffPromptTimer = nil
    handoffSpeech.stopSpeaking(at: .immediate)
  }

  private func scheduleResponseTimeout(uuid: UUID, deadline: String) {
    guard responseDeadlinesByUUID[uuid] != deadline else { return }
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = parser.date(from: deadline)
    if date == nil { parser.formatOptions = [.withInternetDateTime]; date = parser.date(from: deadline) }
    let seconds = min(max(date?.timeIntervalSinceNow ?? 120, 0), 30 * 60)
    responseTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    responseDeadlinesByUUID[uuid] = deadline
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, self.callsByUUID[uuid] != nil else { return }
      self.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      self.removeCall(uuid: uuid)
    }
    responseTimeoutsByUUID[uuid] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: timeout)
  }

  private func removeCall(uuid: UUID) {
    cancelRingTimeout(uuid: uuid)
    answerTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    answerActionsByUUID.removeValue(forKey: uuid)?.fail()
    responseTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    responseDeadlinesByUUID.removeValue(forKey: uuid)
    callUIOwners.remove(uuid)
    stopHandoffPrompt()
    guard let call = callsByUUID.removeValue(forKey: uuid) else { return }
    let attemptId = call["attemptId"] ?? ""
    if !attemptId.isEmpty { uuidByAttempt.removeValue(forKey: attemptId) }
    if let pending = UserDefaults.standard.dictionary(forKey: pendingCallKey) as? [String: String],
       pending["attemptId"] == attemptId {
      UserDefaults.standard.removeObject(forKey: pendingCallKey)
    }
    NotificationCenter.default.post(name: .asinuVoipCallEnded, object: nil, userInfo: call)
  }

  private func scheduleRingTimeout(uuid: UUID, attemptId: String, seconds: Int) {
    cancelRingTimeout(uuid: uuid)
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, self.uuidByAttempt[attemptId] == uuid else { return }
      self.provider.reportCall(with: uuid, endedAt: Date(), reason: .unanswered)
      self.removeCall(uuid: uuid)
    }
    ringTimeoutsByUUID[uuid] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds), execute: timeout)
  }

  private func cancelRingTimeout(uuid: UUID) {
    ringTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
  }

  private func string(_ value: Any?) -> String {
    if let text = value as? String { return text }
    if let number = value as? NSNumber { return number.stringValue }
    return ""
  }
}

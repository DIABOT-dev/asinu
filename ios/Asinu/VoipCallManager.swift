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
  private let maximumCallDuration: TimeInterval = 10 * 60
  private var pushRegistry: PKPushRegistry?
  private var callsByUUID: [UUID: [String: String]] = [:]
  private var uuidByAttempt: [String: UUID] = [:]
  private var endedAttempts: [String: Date] = [:]
  private var ringTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var answerActionsByUUID: [UUID: CXAnswerCallAction] = [:]
  private var answerTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var responseTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var responseDeadlinesByUUID: [UUID: String] = [:]
  private var callTimeoutsByUUID: [UUID: DispatchWorkItem] = [:]
  private var callDeadlinesByUUID: [UUID: Date] = [:]
  private var audioSessionActive = false
  private var responseAfterAudioRelease: [String: String]?
  private var applicationObservers: [NSObjectProtocol] = []

  private lazy var provider: CXProvider = {
    let configuration = CXProviderConfiguration()
    // Check-in is a visual interaction: the user reads guidance and chooses
    // their response on screen. CallKit's visual-call presentation can ask for
    // device unlock and foreground the app on answer. It does not enable a
    // camera, transmit video, or bypass Face ID/passcode.
    configuration.supportsVideo = true
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    configuration.includesCallsInRecents = false
    configuration.ringtoneSound = "asinu_incoming.caf"
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
  }

  func start() {
    // Install CallKit/PushKit before React starts, including cold launches from
    // a push. Never defer native registration behind the JS bootstrap queue.
    if !Thread.isMainThread {
      DispatchQueue.main.sync { self.start() }
      return
    }
    _ = provider
    guard pushRegistry == nil else { return }
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    pushRegistry = registry
    registry.desiredPushTypes = [.voIP]
    let center = NotificationCenter.default
    applicationObservers = [
        center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
          guard let self else { return }
          for call in self.callsByUUID.values where call["nativeAnswered"] == "1" {
            UserDefaults.standard.set(call, forKey: self.pendingCallKey)
          }
        },
        center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
          guard let self else { return }
          self.expireCallsIfNeeded()
          guard let call = self.pendingCall() else { return }
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

  func registration() -> [String: String]? {
    guard let token = UserDefaults.standard.string(forKey: tokenKey), !token.isEmpty else { return nil }
    return ["token": token, "environment": environment]
  }

  func activeCalls() -> [[String: String]] {
    expireCallsIfNeeded()
    // Unlike the pending navigation handoff, this survives app audio ownership.
    // Take a snapshot so a saved check-in can retire only its original calls.
    return Array(callsByUUID.values)
  }

  func consumePendingCall() -> [String: String]? {
    guard let value = pendingCall() else { return nil }
    UserDefaults.standard.removeObject(forKey: pendingCallKey)
    return value
  }

  func pendingCall() -> [String: String]? {
    expireCallsIfNeeded()
    guard let value = UserDefaults.standard.dictionary(forKey: pendingCallKey) as? [String: String],
          let attemptId = value["attemptId"], !attemptId.isEmpty else { return nil }
    if let uuid = uuidByAttempt[attemptId], callsByUUID[uuid]?["nativeAnswered"] == "1" {
      return value
    }
    // A user-ended, already accepted call may still need an on-screen health
    // response. Retain only a short-lived handoff, never a new native call.
    guard value["nativeEnded"] == "1", value["nativeAnswered"] == "1",
          let expiry = value["continuationUntil"].flatMap(Double.init),
          expiry > Date().timeIntervalSince1970 else {
      UserDefaults.standard.removeObject(forKey: pendingCallKey)
      return nil
    }
    return value
  }

  func completeAnswer(attemptId: String, connected: Bool, deadline: String) {
    expireCallsIfNeeded()
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
    expireCallsIfNeeded()
    guard let uuid = uuidByAttempt[attemptId], let call = callsByUUID[uuid], call["nativeAnswered"] == "1" else {
      if active && UIApplication.shared.applicationState == .active && pendingCall()?["attemptId"] == attemptId {
        UserDefaults.standard.removeObject(forKey: pendingCallKey)
      }
      return false
    }
    if active && UIApplication.shared.applicationState == .active {
      if pendingCall()?["attemptId"] == attemptId {
        UserDefaults.standard.removeObject(forKey: pendingCallKey)
      }
    } else {
      UserDefaults.standard.set(call, forKey: pendingCallKey)
    }
    if !deadline.isEmpty { scheduleResponseTimeout(uuid: uuid, deadline: deadline) }
    // Return whether CallKit owns this call's audio session, even when the
    // phone is locked. Expo must not reconfigure that native session.
    return true
  }

  // The self-link only brings the app forward. Routing has one owner in React,
  // so Expo's URL handler and the native event cannot stack duplicate screens.
  func handleAnsweredCallURL(_ url: URL) -> Bool {
    expireCallsIfNeeded()
    guard url.scheme == "asinu-lite", url.host == "checkin-call",
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.queryItems?.contains(where: { $0.name == "nativeAnswered" && $0.value == "1" }) == true,
          let attemptId = components.queryItems?.first(where: { $0.name == "attemptId" })?.value else { return false }
    let call = uuidByAttempt[attemptId].flatMap { callsByUUID[$0] } ?? pendingCall()
    guard let call, call["attemptId"] == attemptId,
          call["nativeAnswered"] == "1", url.path == "/" + (call["episodeId"] ?? "") else { return false }
    UserDefaults.standard.set(call, forKey: pendingCallKey)
    NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: call)
    return true
  }

  func endCall(attemptId: String, reason: CXCallEndedReason = .remoteEnded) {
    if responseAfterAudioRelease?["attemptId"] == attemptId { responseAfterAudioRelease = nil }
    guard let uuid = uuidByAttempt[attemptId] else {
      if pendingCall()?["attemptId"] == attemptId {
        UserDefaults.standard.removeObject(forKey: pendingCallKey)
      }
      return
    }
    provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
    removeCall(uuid: uuid)
  }

  func reportIncoming(payload: [AnyHashable: Any], completion: @escaping () -> Void) {
    let action = string(payload["action"])
    let kind = string(payload["kind"])
    let attemptId = string(payload["attemptId"])
    endedAttempts = endedAttempts.filter { $0.value.timeIntervalSinceNow > -600 }

    if action == "END_CALL" || kind == "END_CALL" {
      if !attemptId.isEmpty { endCall(attemptId: attemptId) }
      // Compatibility for pushes already in flight from older servers. Even
      // an obsolete control push must be reported before completing PushKit.
      reportDiscardedVoipPush(completion: completion)
      return
    }

    let episodeId = string(payload["episodeId"])
    guard !episodeId.isEmpty, !attemptId.isEmpty,
          action.isEmpty || action == "INCOMING_CALL",
          kind.isEmpty || kind == "INCOMING_CALL" else {
      reportDiscardedVoipPush(completion: completion)
      return
    }

    // A duplicate must not reset the ring timer, replace an answered call, or
    // resurrect one that just ended. It still owes PushKit a CallKit report.
    if uuidByAttempt[attemptId] != nil || endedAttempts[attemptId] != nil {
      reportDiscardedVoipPush(completion: completion)
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
    scheduleCallTimeout(uuid: uuid)

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(
      type: .generic,
      value: NSLocalizedString("checkin_call_handle", comment: "CallKit check-in handle")
    )
    update.localizedCallerName = localizedTitle.isEmpty
      ? NSLocalizedString("checkin_call_title", comment: "CallKit check-in title")
      : localizedTitle
    // Every genuine call here leads to the check-in response UI. In CallKit,
    // visual content is not limited to camera feeds (Apple DTS thread 798090).
    // Discarded/duplicate compatibility reports below remain audio-only.
    update.hasVideo = true
    update.supportsDTMF = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false

    let ringtoneConfiguration = provider.configuration
    ringtoneConfiguration.ringtoneSound = severity.uppercased() == "URGENT"
      ? "asinu_emergency.caf" : "asinu_incoming.caf"
    provider.configuration = ringtoneConfiguration
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

  private func reportDiscardedVoipPush(completion: @escaping () -> Void) {
    let uuid = UUID()
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: NSLocalizedString("checkin_call_handle", comment: "CallKit check-in handle"))
    update.localizedCallerName = NSLocalizedString("checkin_call_title", comment: "CallKit check-in title")
    // Do not register a React call, activate audio, or disturb an existing
    // call. Retire this compatibility report as soon as CallKit accepts it.
    provider.reportNewIncomingCall(with: uuid, update: update) { error in
      if error == nil {
        self.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      }
      completion()
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
    expireCallsIfNeeded()
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

    // Answering opens the app's response screen immediately. CallKit does
    // not read a separate reminder while the app is opening or locked.
    openResponseScreen(call)
  }

  private func openResponseScreen(_ call: [String: String]) {
    var components = URLComponents()
    components.scheme = "asinu-lite"
    components.host = "checkin-call"
    components.path = "/" + (call["episodeId"] ?? "")
    components.queryItems = [
      URLQueryItem(name: "attemptId", value: call["attemptId"]),
      URLQueryItem(name: "nativeAnswered", value: "1"),
    ]
    if let url = components.url {
      DispatchQueue.main.async {
        // CallKit may already have foregrounded this visual call. React's
        // pending-call recovery owns routing; don't open a second self-link.
        // A call that ended while this block was queued must not open the app.
        guard self.pendingCall()?["attemptId"] == call["attemptId"],
              UIApplication.shared.applicationState != .active else { return }
        UIApplication.shared.open(url, options: [:]) { opened in
          #if DEBUG
          if !opened {
            print("[AsinuVoip] Response screen open was declined by iOS; pending handoff retained")
          }
          #endif
        }
      }
    }
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    expireCallsIfNeeded()
    let continuation = responseContinuation(uuid: action.callUUID)
    removeCall(uuid: action.callUUID)
    action.fulfill()
    if let continuation {
      responseAfterAudioRelease = audioSessionActive ? continuation : nil
      UserDefaults.standard.set(continuation, forKey: pendingCallKey)
      NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: continuation)
      openResponseScreen(continuation)
    }
  }

  private func responseContinuation(uuid: UUID) -> [String: String]? {
    guard var call = callsByUUID[uuid], call["nativeAnswered"] == "1",
          answerActionsByUUID[uuid] == nil else { return nil }
    let now = Date().timeIntervalSince1970
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let deadline = responseDeadlinesByUUID[uuid] ?? ""
    var date = parser.date(from: deadline)
    if date == nil { parser.formatOptions = [.withInternetDateTime]; date = parser.date(from: deadline) }
    let expiry = min(now + 120, date?.timeIntervalSince1970 ?? now + 120)
    guard expiry > now else { return nil }
    call["nativeEnded"] = "1"
    call["continuationUntil"] = String(expiry)
    return call
  }

  func providerDidReset(_ provider: CXProvider) {
    responseAfterAudioRelease = nil
    for uuid in Array(callsByUUID.keys) { removeCall(uuid: uuid) }
    audioSessionActive = false
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    expireCallsIfNeeded()
    audioSessionActive = true
    configureAudioSession()
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    audioSessionActive = false
    // An already-visible response screen may have been playing through the
    // native session. Let it re-prepare Expo playback only AFTER CallKit has
    // released that session; do not replay completed or declined calls.
    if var continuation = responseAfterAudioRelease {
      responseAfterAudioRelease = nil
      if let expiry = continuation["continuationUntil"].flatMap(Double.init), expiry > Date().timeIntervalSince1970 {
        continuation["audioSessionReleased"] = "1"
        NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: continuation)
      }
    }
  }

  func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) {
    guard let callAction = action as? CXCallAction else { return }
    removeCall(uuid: callAction.callUUID)
  }

  private func configureAudioSession() {
    do {
      // The app reads prompts on its response screen, without two-way speech.
      // voiceChat without a voice-processing I/O unit lowers playback gain.
      // Default to speaker, but keep headset/Bluetooth and user route choices.
      try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothHFP, .defaultToSpeaker])
    } catch {
      // Do not activate manually: CallKit owns audio-session activation.
    }
  }

  // This cap starts with the incoming call and is independent of React,
  // server deadlines, and whether the user has already opened the app.
  // Accepting or refreshing a response must never extend its lifetime.
  private func scheduleCallTimeout(uuid: UUID) {
    guard callsByUUID[uuid] != nil, callDeadlinesByUUID[uuid] == nil else { return }
    callDeadlinesByUUID[uuid] = Date().addingTimeInterval(maximumCallDuration)
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, self.callsByUUID[uuid] != nil else { return }
      self.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      self.removeCall(uuid: uuid)
    }
    callTimeoutsByUUID[uuid] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + maximumCallDuration, execute: timeout)
  }

  private func expireCallsIfNeeded() {
    // Reconcile wall-clock deadlines after iOS suspends/resumes the app,
    // before restoring navigation or claiming the native audio session.
    let now = Date()
    let expired = callDeadlinesByUUID.filter { $0.value <= now }.map { $0.key }
    for uuid in expired {
      guard callsByUUID[uuid] != nil else { continue }
      provider.reportCall(with: uuid, endedAt: now, reason: .remoteEnded)
      removeCall(uuid: uuid)
    }
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
    callTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    callDeadlinesByUUID.removeValue(forKey: uuid)
    cancelRingTimeout(uuid: uuid)
    answerTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    answerActionsByUUID.removeValue(forKey: uuid)?.fail()
    responseTimeoutsByUUID.removeValue(forKey: uuid)?.cancel()
    responseDeadlinesByUUID.removeValue(forKey: uuid)
    guard let call = callsByUUID.removeValue(forKey: uuid) else { return }
    let attemptId = call["attemptId"] ?? ""
    if !attemptId.isEmpty {
      uuidByAttempt.removeValue(forKey: attemptId)
      endedAttempts[attemptId] = Date()
    }
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

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

  private lazy var provider: CXProvider = {
    let configuration = CXProviderConfiguration(localizedName: "Asinu")
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
  }

  func start() {
    DispatchQueue.main.async {
      _ = self.provider
      guard self.pushRegistry == nil else { return }
      let registry = PKPushRegistry(queue: .main)
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
      self.pushRegistry = registry

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
    guard let value = UserDefaults.standard.dictionary(forKey: pendingCallKey) as? [String: String] else {
      return nil
    }
    UserDefaults.standard.removeObject(forKey: pendingCallKey)
    return value
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
    ]
    callsByUUID[uuid] = call
    uuidByAttempt[attemptId] = uuid

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: "Check-in")
    update.localizedCallerName = localizedTitle.isEmpty ? "Asinu Check-in" : localizedTitle
    update.hasVideo = false
    update.supportsDTMF = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false

    provider.reportNewIncomingCall(with: uuid, update: update) { error in
      #if DEBUG
      if let error { print("[AsinuVoip] CallKit report failed: \(error.localizedDescription)") }
      else { print("[AsinuVoip] CallKit incoming call reported") }
      #endif
      if error != nil {
        self.removeCall(uuid: uuid)
      } else {
        self.scheduleRingTimeout(uuid: uuid, attemptId: attemptId, seconds: ringSeconds)
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
    guard let call = callsByUUID[action.callUUID] else {
      action.fail()
      return
    }

    cancelRingTimeout(uuid: action.callUUID)
    UserDefaults.standard.set(call, forKey: pendingCallKey)
    NotificationCenter.default.post(name: .asinuVoipCallAnswered, object: nil, userInfo: call)
    action.fulfill()

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
    ringTimeoutsByUUID.values.forEach { $0.cancel() }
    ringTimeoutsByUUID.removeAll()
    callsByUUID.removeAll()
    uuidByAttempt.removeAll()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    do {
      try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .defaultToSpeaker])
    } catch {
      // LiveKit/expo-audio can still configure the session when the in-app UI opens.
    }
  }

  private func removeCall(uuid: UUID) {
    cancelRingTimeout(uuid: uuid)
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

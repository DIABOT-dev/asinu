import Foundation
import React

@objc(AsinuVoipModule)
final class AsinuVoipModule: RCTEventEmitter {
  private var observing = false
  private var observers: [NSObjectProtocol] = []

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["onVoipToken", "onVoipCallAnswered", "onVoipCallEnded"]
  }

  override func startObserving() {
    observing = true
    let center = NotificationCenter.default
    observers = [
      center.addObserver(forName: .asinuVoipTokenUpdated, object: nil, queue: .main) { [weak self] note in
        self?.emit("onVoipToken", note.userInfo)
      },
      center.addObserver(forName: .asinuVoipCallAnswered, object: nil, queue: .main) { [weak self] note in
        self?.emit("onVoipCallAnswered", note.userInfo)
      },
      center.addObserver(forName: .asinuVoipCallEnded, object: nil, queue: .main) { [weak self] note in
        self?.emit("onVoipCallEnded", note.userInfo)
      },
    ]
  }

  override func stopObserving() {
    observing = false
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
  }

  deinit {
    observers.forEach(NotificationCenter.default.removeObserver)
  }

  @objc(getRegistration:rejecter:)
  func getRegistration(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(VoipCallManager.shared.registration())
  }

  @objc(consumePendingCall:rejecter:)
  func consumePendingCall(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(VoipCallManager.shared.consumePendingCall())
  }

  @objc(endCall:resolver:rejecter:)
  func endCall(
    _ attemptId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    VoipCallManager.shared.endCall(attemptId: attemptId)
    resolve(true)
  }

  @objc(simulateIncomingCall:resolver:rejecter:)
  func simulateIncomingCall(
    _ payload: [AnyHashable: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if DEBUG
    VoipCallManager.shared.simulateIncoming(payload: payload) { resolve(true) }
    #else
    reject("NOT_AVAILABLE", "VoIP call simulation is available only in Debug builds", nil)
    #endif
  }

  private func emit(_ name: String, _ body: [AnyHashable: Any]?) {
    guard observing else { return }
    sendEvent(withName: name, body: body ?? [:])
  }
}

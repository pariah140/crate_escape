import Foundation
import StoreKit
import Capacitor

@objc(CrateNativePlugin)
public class CrateNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CrateNativePlugin"
    public let jsName = "CrateNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readCloud", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeCloud", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default
    private let prefix = "crate-escape-device-v1:"
    private var observer: NSObjectProtocol?

    @objc override public func load() {
        observer = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store,
            queue: .main
        ) { [weak self] notification in
            let reason = notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int ?? -1
            self?.notifyListeners("cloudChanged", data: ["reason": reason, "quotaExceeded": reason == NSUbiquitousKeyValueStoreQuotaViolationChange])
        }
        store.synchronize()
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }

    @objc func readCloud(_ call: CAPPluginCall) {
        let synchronized = store.synchronize()
        let available = FileManager.default.ubiquityIdentityToken != nil && synchronized
        let records = store.dictionaryRepresentation.keys.compactMap { key -> [String: String]? in
            guard key.hasPrefix(prefix), let value = store.string(forKey: key) else { return nil }
            return ["key": key, "value": value]
        }
        call.resolve(["available": available, "records": records])
    }

    @objc func writeCloud(_ call: CAPPluginCall) {
        guard FileManager.default.ubiquityIdentityToken != nil else {
            call.reject("iCloud is not available on this device")
            return
        }
        guard let deviceId = call.getString("deviceId"),
              let value = call.getString("value"),
              UUID(uuidString: deviceId) != nil,
              value.utf8.count < 64_000 else {
            call.reject("Invalid or oversized save")
            return
        }
        store.set(value, forKey: prefix + deviceId)
        call.resolve()
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["productIds": await entitlementIds()])
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["productIds": await entitlementIds()])
            } catch {
                call.reject("Could not restore purchases: \(error.localizedDescription)")
            }
        }
    }

    private func entitlementIds() async -> [String] {
        var ids: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil {
                ids.append(transaction.productID)
            }
        }
        return ids
    }
}

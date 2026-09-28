import Foundation
import StoreKit
import CloudKit
import Capacitor

private struct TokenWallet: Codable {
    var grants: [String: Int] = [:]
    var refunds: [String: Int] = [:]
    var harborDiscounts: [String: Int] = [:]

    var balance: Int {
        max(0, grants.values.reduce(0, +) - refunds.values.reduce(0, +) - harborDiscounts.values.reduce(0, +))
    }
    var payload: [String: Any] {
        ["balance": balance, "discountedHarbors": harborDiscounts.keys.compactMap(Int.init).sorted()]
    }
}

private enum WalletFailure: LocalizedError {
    case noICloud, insufficientTokens, invalidHarbor, conflict, corruptWallet, invalidPurchase
    var errorDescription: String? {
        switch self {
        case .noICloud: return "Sign in to iCloud to use Chart Tokens. No purchase was made."
        case .insufficientTokens: return "Not enough Chart Tokens for this harbour chart."
        case .invalidHarbor: return "This harbour chart is unavailable."
        case .conflict: return "Your iCloud wallet changed. Please try again."
        case .corruptWallet: return "Your iCloud wallet could not be read. Contact support before buying tokens."
        case .invalidPurchase: return "The App Store purchase could not be verified."
        }
    }
}

// Paid value lives in one private CloudKit record, separate from the selectable voyage save.
// Change-tag writes make two-device spending conditional on the latest wallet version.
private actor TokenWalletStore {
    private let database = CKContainer.default().privateCloudDatabase
    private let recordID = CKRecord.ID(recordName: "chart-token-wallet-v1")

    private func checkAccount() async throws {
        guard try await CKContainer.default().accountStatus() == .available else { throw WalletFailure.noICloud }
    }

    private func fetch() async throws -> (CKRecord, TokenWallet) {
        try await checkAccount()
        do {
            let record = try await database.record(for: recordID)
            guard let data = record["payload"] as? Data,
                  let wallet = try? JSONDecoder().decode(TokenWallet.self, from: data) else { throw WalletFailure.corruptWallet }
            return (record, wallet)
        } catch let error as CKError where error.code == .unknownItem {
            return (CKRecord(recordType: "CrateTokenWallet", recordID: recordID), TokenWallet())
        }
    }

    func snapshot() async throws -> [String: Any] {
        let (_, wallet) = try await fetch()
        return wallet.payload
    }

    private func change(_ update: (inout TokenWallet) throws -> Bool) async throws -> [String: Any] {
        for _ in 0..<6 {
            var (record, wallet) = try await fetch()
            if try !update(&wallet) { return wallet.payload }
            record["payload"] = try JSONEncoder().encode(wallet) as NSData
            do {
                let result = try await database.modifyRecords(saving: [record], deleting: [], savePolicy: .ifServerRecordUnchanged, atomically: false)
                if let saved = result.saveResults[recordID] {
                    switch saved {
                    case .success: return wallet.payload
                    case .failure(let error):
                        if (error as? CKError)?.code == .serverRecordChanged || (error as? CKError)?.code == .unknownItem { continue }
                        throw error
                    }
                }
                throw WalletFailure.conflict
            } catch let error as CKError where error.code == .serverRecordChanged || error.code == .unknownItem {
                continue
            }
        }
        throw WalletFailure.conflict
    }

    func grant(transactionID: String, amount: Int) async throws -> [String: Any] {
        try await change { wallet in
            if wallet.grants[transactionID] != nil { return false }
            wallet.grants[transactionID] = amount
            return true
        }
    }

    func refund(transactionID: String) async throws -> [String: Any] {
        try await change { wallet in
            guard let grant = wallet.grants[transactionID], wallet.refunds[transactionID] == nil else { return false }
            wallet.refunds[transactionID] = grant
            return true
        }
    }

    func discount(harbor: Int) async throws -> [String: Any] {
        guard (2...24).contains(harbor) else { throw WalletFailure.invalidHarbor }
        let cost = max(5, (harbor * 250 - 250 + 199) / 200)
        return try await change { wallet in
            let key = String(harbor)
            if wallet.harborDiscounts[key] != nil { return false }
            guard wallet.balance >= cost else { throw WalletFailure.insufficientTokens }
            wallet.harborDiscounts[key] = cost
            return true
        }
    }
}

@objc(CrateNativePlugin)
public class CrateNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CrateNativePlugin"
    public let jsName = "CrateNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readCloud", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeCloud", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tokenProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tokenWallet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchaseTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discountHarbor", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default
    private let prefix = "crate-escape-device-v1:"
    private var observer: NSObjectProtocol?
    private let wallet = TokenWalletStore()
    private var transactionTask: Task<Void, Never>?
    private var unfinishedTask: Task<Void, Never>?
    private static let tokenPacks = [
        "com.pariah140.crateescape.charttokens30": 30,
        "com.pariah140.crateescape.charttokens90": 90,
        "com.pariah140.crateescape.charttokens220": 220
    ]

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
        transactionTask = Task { [weak self] in
            guard let self else { return }
            for await result in Transaction.updates { await self.recover(result) }
        }
        unfinishedTask = Task { [weak self] in
            guard let self else { return }
            for await result in Transaction.unfinished { await self.recover(result) }
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
        transactionTask?.cancel()
        unfinishedTask?.cancel()
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

    @objc func tokenProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: Array(Self.tokenPacks.keys))
                call.resolve(["products": products.compactMap { product -> [String: Any]? in
                    guard let amount = Self.tokenPacks[product.id], product.type == .consumable else { return nil }
                    return ["id": product.id, "amount": amount, "price": product.displayPrice]
                }.sorted { ($0["amount"] as? Int ?? 0) < ($1["amount"] as? Int ?? 0) }])
            } catch { call.reject("Could not load App Store prices: \(error.localizedDescription)") }
        }
    }

    @objc func tokenWallet(_ call: CAPPluginCall) {
        Task {
            do { call.resolve(try await wallet.snapshot()) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func purchaseTokens(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), Self.tokenPacks[id] != nil else {
            call.reject("Unknown token pack")
            return
        }
        Task {
            do {
                // Do not display Apple's payment sheet until the iCloud wallet can be read.
                _ = try await wallet.snapshot()
                guard let product = try await Product.products(for: [id]).first, product.type == .consumable else {
                    call.reject("This token pack is not available in the App Store yet")
                    return
                }
                switch try await product.purchase() {
                case .success(let result):
                    guard case .verified(let transaction) = result else { throw WalletFailure.invalidPurchase }
                    let snapshot = try await deliver(transaction)
                    call.resolve(["status": "purchased", "wallet": snapshot])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.resolve(["status": "pending"])
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func discountHarbor(_ call: CAPPluginCall) {
        guard let harbor = call.getInt("harbor") else { call.reject("Missing harbour"); return }
        Task {
            do {
                let snapshot = try await wallet.discount(harbor: harbor)
                call.resolve(["wallet": snapshot])
                notifyListeners("tokenWalletChanged", data: snapshot)
            } catch { call.reject(error.localizedDescription) }
        }
    }

    private func deliver(_ transaction: Transaction) async throws -> [String: Any] {
        guard transaction.appBundleID == Bundle.main.bundleIdentifier,
              transaction.productType == .consumable,
              let units = Self.tokenPacks[transaction.productID],
              transaction.purchasedQuantity > 0 else { throw WalletFailure.invalidPurchase }
        let snapshot: [String: Any]
        if transaction.revocationDate != nil {
            snapshot = try await wallet.refund(transactionID: String(transaction.id))
        } else {
            snapshot = try await wallet.grant(transactionID: String(transaction.id), amount: units * transaction.purchasedQuantity)
        }
        await transaction.finish() // CloudKit confirmed the grant before StoreKit drops it from unfinished.
        notifyListeners("tokenWalletChanged", data: snapshot)
        return snapshot
    }

    private func recover(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = result,
              Self.tokenPacks[transaction.productID] != nil else { return }
        // On iCloud failure the transaction remains unfinished and is retried next launch.
        _ = try? await deliver(transaction)
    }
}

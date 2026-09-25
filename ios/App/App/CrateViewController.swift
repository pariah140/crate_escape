import Capacitor

@objc(CrateViewController)
class CrateViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CrateNativePlugin())
    }
}

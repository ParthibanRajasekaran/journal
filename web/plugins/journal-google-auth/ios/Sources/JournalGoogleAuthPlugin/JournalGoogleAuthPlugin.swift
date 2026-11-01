import Foundation
import Capacitor
import GoogleSignIn

// Google-only sign-in. Presents Google's own sheet through GoogleSignIn-iOS and resolves with the ID token.
// Errors are rejected with the codes USER_CANCELLED, NOT_CONFIGURED, UNAVAILABLE or FAILED.
@objc(JournalGoogleAuthPlugin)
public class JournalGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "JournalGoogleAuthPlugin"
    public let jsName = "JournalGoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise)
    ]

    @objc func login(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("nonce is required", "FAILED")
            return
        }
        guard let webClientId = call.getString("webClientId"), !webClientId.isEmpty else {
            call.reject("webClientId is not configured for this build", "NOT_CONFIGURED")
            return
        }
        guard let iosClientId = call.getString("iosClientId"), !iosClientId.isEmpty else {
            call.reject("iosClientId is not configured for this build", "NOT_CONFIGURED")
            return
        }
        let scheme = reversedClientId(iosClientId)
        guard urlSchemeRegistered(scheme) else {
            call.reject("Info.plist has no URL scheme \(scheme). Add the reversed iOS client ID under CFBundleURLTypes.", "NOT_CONFIGURED")
            return
        }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("no view controller is available to present sign-in", "UNAVAILABLE")
                return
            }
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: iosClientId, serverClientID: webClientId)
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: nil, nonce: nonce) { result, error in
                if let error = error as NSError? {
                    if error.domain == kGIDSignInErrorDomain && error.code == GIDSignInError.canceled.rawValue {
                        call.reject("sign-in was cancelled", "USER_CANCELLED")
                    } else {
                        call.reject(error.localizedDescription, "FAILED")
                    }
                    return
                }
                guard let token = result?.user.idToken?.tokenString, !token.isEmpty else {
                    call.reject("Google returned no ID token", "FAILED")
                    return
                }
                call.resolve(["idToken": token])
            }
        }
    }

    // iOS client ID "123-abc.apps.googleusercontent.com" -> URL scheme "com.googleusercontent.apps.123-abc".
    private func reversedClientId(_ clientId: String) -> String {
        clientId.split(separator: ".").reversed().joined(separator: ".")
    }

    private func urlSchemeRegistered(_ scheme: String) -> Bool {
        let types = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        return types.contains { entry in
            let schemes = entry["CFBundleURLSchemes"] as? [String] ?? []
            return schemes.contains(scheme)
        }
    }
}

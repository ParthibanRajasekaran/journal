// swift-tools-version: 5.9
import PackageDescription

// The plugin depends only on Capacitor and GoogleSignIn-iOS. Facebook is not a dependency.
let package = Package(
    name: "JournalGoogleAuth",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "JournalGoogleAuth", targets: ["JournalGoogleAuthPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", exact: "9.2.0")
    ],
    targets: [
        .target(
            name: "JournalGoogleAuthPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")
            ],
            path: "ios/Sources/JournalGoogleAuthPlugin")
    ]
)

# Licence review for the native spike

Checked 1 November 2026, from the packages' own licence files and from the repositories named below.
This is engineering review, not legal advice. Items marked ESCALATE need an owner decision before any build leaves
this machine.

## Direct dependencies (pinned exactly in `web/package.json`)

| Package | Version | Licence | Obligations for an installed or distributed build |
|---|---|---|---|
| `@capgo/capacitor-social-login` | 8.7.5 | MPL-2.0 (file-level copyleft) | Ship the licence text and notices. If a file of the plugin is modified, its source must be made available under MPL-2.0. This spike modifies no plugin file. |
| `@aparajita/capacitor-secure-storage` | 8.0.1 | MIT | Keep the copyright and licence notice. |
| `@capacitor/android`, `@capacitor/ios`, `@capacitor/core` | 8.5.3 | MIT | Keep the notice. |

## Transitive dependencies that a build pulls in

| Dependency | Pulled in by | Licence | Status |
|---|---|---|---|
| `tslib` | npm, several packages | 0BSD | No obligation beyond notice. |
| `androidx.credentials` 1.5.0, `androidx.browser` 1.9.0 | social-login Android | Apache-2.0 | Keep notices. |
| GoogleSignIn-iOS (`google/GoogleSignIn-iOS`, `>= 9.0.0`) | social-login iOS, Swift package | Apache-2.0. Verified from the repository licence. | Keep the licence text. Apache-2.0 section 4 requires it, and any NOTICE file it ships, to be reproduced. |
| GTMAppAuth, gtm-session-fetcher, interop-ios-for-google-sdks, promises | GoogleSignIn-iOS | Apache-2.0 (per their repositories; read individually before distribution) | Keep notices. Not individually verified in this spike. |
| `keychain-swift` 21.0.0 | secure-storage iOS | MIT (per repository; not re-read in this spike) | Keep notice. |
| `capacitor-swift-pm` 8.5.3 | Capacitor iOS | MIT | Keep notice. |
| **facebook-ios-sdk** 18.1.1 (`FacebookCore`, `FacebookLogin`) | social-login iOS, Swift package, **unconditional** | Meta's own licence, read from `facebook/facebook-ios-sdk` LICENSE on 1 November 2026. Grants use "in connection with the web services and APIs provided by Facebook", and makes use "subject to the Facebook Platform Policy". | **ESCALATE.** See below. |

## ESCALATE: the Facebook SDK is linked into every iOS build

- The social-login plugin's iOS target depends on `FacebookCore` and `FacebookLogin` in every build, even for a
  Google-only app. The Android side gates its Facebook code behind `includeFacebook`, which the default build does
  not set. iOS has no such gate.
- Meta's licence limits use to connection with Facebook's services, and makes it subject to Facebook's platform policy.
  This app does not connect to Facebook's services. Linking the SDK into it is therefore outside what the licence
  grants, and it brings Facebook's policy terms into a Google-only app.
- Facebook's SDK also carries its own data-collection behaviour, which would need to be disclosed in the App Store
  privacy answers.
- **Options, none applied:** (a) an owner decision to accept Meta's terms and disclosures, which I do not recommend;
  (b) a native plugin written in this repository that calls GoogleSignIn-iOS directly, with no Facebook dependency;
  (c) a different plugin, after the same review.
- **Spike status:** the Facebook SDK is linked in the spike's iOS build only if that build runs, and the iOS build is
  currently blocked (see `EVIDENCE.md`). The spike's personal-device use is not distribution. Nothing is distributed.

## Android-only build flag

`includeFacebook` is not set by this repository, so the default Android build contains the disabled stub. The merged
APK was checked for `com.facebook` classes only indirectly (the build log); verify before any release.

## Permissions added by libraries (not by this app)

The merged Android manifest of the debug build requests, besides this app's `INTERNET`:

- `USE_CREDENTIALS`, declared by the social-login plugin. Not used by any plugin code path that was found, but not
  removed: removing it needs a device check of Google sign-in.
- `AD_ID` and `ACCESS_ADSERVICES_*`, added through the Google Play services dependencies. The app does not use
  advertising. These need a privacy review and a device check before release.
- `USE_FINGERPRINT`, from a dependency not yet traced.

`USE_BIOMETRIC`, which the plugin also declared and its code never used, is removed with a manifest override in
`web/android/app/src/main/AndroidManifest.xml`.

## Notices required in any distributed build

1. The licence texts for MPL-2.0, Apache-2.0, MIT and 0BSD, and the NOTICE files that the Apache packages ship.
2. A statement that the social-login plugin is MPL-2.0 and where its source is available (the npm tarball and the
   GitHub repository `Cap-go/capacitor-social-login`).
3. The Facebook SDK entry, if the Facebook SDK is still linked. Not acceptable until the ESCALATE item is decided.

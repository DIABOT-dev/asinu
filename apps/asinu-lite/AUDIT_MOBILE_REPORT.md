Mobile Audit Report (Android + iOS) — 04/12/2025

Source: apps/asinu-lite (React Native/Expo)

ANDROID
Hard Rejection (Play)
- Forbidden permissions: REMOVED (READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW) from android/app/src/main/AndroidManifest.xml.
- Package/namespace/appId: Aligned to com.asinu.lite in Manifest, build.gradle, and native sources.
- Dynamic loading/WebView/private API: Not detected.
- Cleartext: network_security_config added (cleartext off; dev 10.0.2.2 allowed).
- Status: SAFE (store Data Safety/Privacy Policy still required outside repo).

Best Practices / Cleanliness
- New Architecture: disabled in app config and gradle.properties for stability.
- CI gate: daily-build workflow now runs npm install, npm run lint, npm run type-check before EAS build.
- Target/compile SDK: RN/Expo defaults (verify SDK 35 in CI). No Hilt/Room/etc. (RN app).
- Env: HTTPS enforced for staging/prod (src/lib/env.ts).

Submission Readiness (Play)
- [x] No forbidden permissions
- [x] No WebView wrapper/dynamic loading/reflection
- [x] Package ID consistent: com.asinu.lite
- [x] Cleartext constrained via network_security_config
- [ ] Data Safety form + Privacy Policy link (store setup)
- [ ] Confirm targetSdk/compileSdk 35 in build output
- Verdict: NOT READY until store forms are completed and SDK level confirmed.

Open Actions (Android)
P0: Complete Play Data Safety + Privacy Policy (store-side).  
P1: Confirm target/compile SDK 35 in CI output; consider tests/smoke before release.

iOS
Hard Rejection (App Store)
- Dynamic code loading: none beyond standard Expo bundling.
- WebView wrapper: none in app code.
- Tracking/consent: no analytics/ads SDK; ATT not needed yet.
- Status: SAFE on code; store metadata still required.

Best Practices / Cleanliness
- Native project generated via `expo prebuild --platform ios --clean`.
- Bundle ID: com.asinu.lite (Info.plist + project.pbxproj).
- Min iOS: 16.0 (MinimumOSVersion). Hermes enabled.
- ATS: NSAllowsArbitraryLoads=false; LocalNetworking true for dev.
- Privacy manifest: ios/PrivacyInfo.xcprivacy present (no tracking/collection declared).
- No IAP/permissions implemented; RN code modular TS.

Submission Readiness (App Store)
- [x] Bundle ID consistent
- [x] Min iOS 16 set; ATS enforced
- [x] Privacy manifest present
- [ ] Device testing on real iOS 17/18 hardware
- [ ] EAS iOS build/TestFlight pending (CocoaPods install on macOS needed)
- [ ] App Store privacy form/metadata (outside repo)
- Verdict: NOT READY until build/test on devices and store metadata completed.

Open Actions (iOS)
P0: Build iOS (EAS) and test on devices (iOS 17/18).  
P1: App Store privacy form/metadata; ATT flow if analytics/ads added later.  
P2: Optional E2E smoke for iOS once APIs stable.

---
Daily Work Summary (04/12/2025)
- Permissions cleanup: Removed READ/WRITE_EXTERNAL_STORAGE and SYSTEM_ALERT_WINDOW from android/app/src/main/AndroidManifest.xml; also scrubbed from debug/debugOptimized manifests.
- ID alignment: Set package/namespace/applicationId to com.asinu.lite in Manifest/build.gradle and moved native sources to android/app/src/main/java/com/asinu/lite (updated package declarations).
- Network security: Added android/app/src/main/res/xml/network_security_config.xml (cleartext off; dev 10.0.2.2 allowed) and referenced in application tag.
- New Architecture: Disabled in android/gradle.properties to match app config.
- iOS prebuild: Generated ios/ with bundleId com.asinu.lite; set MinimumOSVersion=16.0 (Info.plist), IPHONEOS_DEPLOYMENT_TARGET=16.0 (project.pbxproj), ATS enforced (no arbitrary loads, local networking true), added ios/PrivacyInfo.xcprivacy (no tracking/collection).
- Expo config: Updated ios icon path to AppIcon-1024x1024.png; kept Hermes on, newArch off, ids aligned.
- CI: .github/workflows/daily-build.yml now runs npm install, npm run lint, npm run type-check before EAS build.
- Sanity checks run:
  - `grep -R "READ_EXTERNAL_STORAGE" android || echo no_READ_EXTERNAL_STORAGE`
  - `grep -R "WRITE_EXTERNAL_STORAGE" android || echo no_WRITE_EXTERNAL_STORAGE`
  - `grep -R "SYSTEM_ALERT_WINDOW" android || echo no_SYSTEM_ALERT_WINDOW`
  - `grep -R --exclude-dir=node_modules --exclude-dir=.git "com.diabot.asinulite" . || echo no_old_appId`
  - `npx expo config --type public` → android.package & ios.bundleIdentifier = com.asinu.lite
- Build guidance:
  - Android: `cd apps/asinu-lite && eas build -p android --profile production`
  - iOS: `cd apps/asinu-lite && eas build -p ios --profile production` (run on macOS/CocoaPods)
  - Dev client: WSL `./dev.sh`, Windows `./dev-connect.ps1` for emulator link; smoke UI flows (Auth, Home, Logs, Profile) on devices.

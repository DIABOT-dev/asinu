# RELEASE_IOS.md

Step-by-step instructions for building, testing, and submitting the Asinu iOS app to App Store Connect.

## 1. Requirements
- Apple Developer Program account with appropriate access.
- Xcode (latest stable) installed on macOS.
- Access to the source repo (branch synced with backend changes).
- Metadata + templates stored in `store/ios/` (VI + EN descriptions, privacy, export compliance).
- Legal docs hosted (see `docs/privacy-policy.*` and `docs/terms-of-use.vi.md`).
- Capacitor shell sources under `mobile-shell/`. On macOS run:
  ```bash
  cd mobile-shell
  npm install
  npx cap add ios   # one-time, creates ios/ folder
  npx cap sync ios
  ```
  Then open `ios/App/App.xcworkspace` in Xcode to archive.

## 2. Local build & archive
1. Install dependencies (e.g., `npm install`, `pod install` if using React Native/Expo bare).
2. Open Xcode workspace.
3. Select the correct bundle identifier (`com.diabot.asinu`).
4. Ensure “Automatically manage signing” is ON for development teams.
5. Choose `Any iOS Device (arm64)` target.
6. From menu: **Product → Archive**. Wait for Xcode to finish and show Organizer.

## 3. TestFlight workflow
- **Internal testers**: upload build through Organizer → Distribute App → App Store Connect → Upload → Select “Internal testing”. Add team emails (product, QA).
- **External testers**: create testing group, fill in `What to Test` notes, submit build for Apple review specific to external testing.
- Track build numbers using the same semver as Android (e.g., 0.1.0 / build 1).

## 4. Metadata preparation
- Use `store/ios/app_store_metadata.en.md` and `.vi.md` for localization text.
- Link Support/Marketing URLs when available.
- For Privacy section, copy data from `store/ios/app_privacy_template.md` once values are confirmed.
- For Export Compliance, fill `store/ios/export_compliance_template.md` and paste answers into App Store Connect.

## 5. Submit for review
1. Select the archived build under **App Store → iOS App → Builds**.
2. Fill metadata for each locale.
3. Attach screenshots per device family (iPhone 6.7", 6.5", etc.).
4. Import privacy + encryption answers.
5. Provide contact info and notes for reviewer (mention Asinu is a wellness companion, not a medical device).
6. Choose release mode:
   - Manual release (default) → you manually push once approved.
   - Automatic release → Apple publishes immediately after approval.

## 6. Post-approval checklist
- Update CHANGELOG or sprint report with build number.
- Sync release tags (`git tag ios-v0.1.0` etc.).
- Notify Dia Brain / sponsor teams once the build is live.

## 7. References
- Apple docs: [App Store Connect Help](https://developer.apple.com/support/app-store-connect/)
- Internal metadata folder: `store/ios/`

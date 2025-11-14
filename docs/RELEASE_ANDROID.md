# RELEASE_ANDROID.md

Guideline for preparing, building, and publishing the Asinu Android app (Google Play Console).

## 1. Prerequisites
- Google Play Console developer account (25 USD one-time fee).
- Access to source code + Android SDK.
- Assets stored in `store/android/`:
  - `app_listing.en.md` and `app_listing.vi.md`
  - Icon 512×512
  - 9:16 screenshots (≥3)
  - Feature graphic 1024×500
- Valid keystore + `android/keystore.properties` (never committed; see section 4).

## 2. Versioning Rules
- Package name must stay `com.diabot.asinu`.
- `versionName` (semantic) and `versionCode` (integer) live in `android/app/build.gradle` (or Expo config). Example:
  ```gradle
  defaultConfig {
      applicationId "com.diabot.asinu"
      versionCode 1
      versionName "0.1.0"
  }
  ```
- Always bump `versionCode` when shipping a new build; bump `versionName` following semver.
- Track changes in this file alongside release notes.

## 3. Build Release AAB locally
1. Ensure Node/Expo deps installed, then set env vars if needed.
2. (Optional) copy keystore template: `cp android/keystore.properties.example android/keystore.properties` and update secrets.
3. Generate release bundle:
   ```bash
   npm run build:android:release
   ```
   which runs `cd android && ./gradlew bundleRelease`.
4. Output AAB location: `android/app/build/outputs/bundle/release/app-release.aab`.

## 4. Signing configuration (no secrets committed)
- Template file: `android/keystore.properties.example`
  ```properties
  storePassword=
  keyPassword=
  keyAlias=asinu
  storeFile=asinu-release.keystore
  ```
- Actual secrets go to `android/keystore.properties` (ignored by git) and keystore binary `android/app/asinu-release.keystore`.
- Update `android/app/build.gradle` to load signing info:
  ```gradle
  def keystorePropertiesFile = rootProject.file("keystore.properties")
  def keystoreProperties = new Properties()
  if (keystorePropertiesFile.exists()) {
      keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
  }

  signingConfigs {
      release {
          if (keystoreProperties["storeFile"]) {
              storeFile file(keystoreProperties["storeFile"])
              storePassword keystoreProperties["storePassword"]
              keyAlias keystoreProperties["keyAlias"]
              keyPassword keystoreProperties["keyPassword"]
          }
      }
  }
  ```
- When the file is missing, Gradle should fall back to debug signing so CI builds succeed.

## 5. Google Play submission workflow
1. **Prepare assets**
   - Review metadata files in `store/android/`.
   - Export icon + screenshots from design team.
2. **Create/Update app listing**
   - App name: _Asinu: Family Health Companion_
   - Default language: Vietnamese (vi-VN) or English as required.
   - Package: `com.diabot.asinu`
   - Paste metadata + features from `app_listing.*.md`.
3. **Data Safety form**
   - Use `store/android/data_safety_template.md` as baseline.
   - Verify sharing/encryption answers with legal & backend team.
4. **Content Rating questionnaire**
   - Use `store/android/content_rating_answers.md`.
   - Reconfirm “wellness assistant only” statement.
5. **Upload build**
   - Navigate to “Internal testing”, upload latest `.aab` bundle.
   - Provide release notes (link to `README.md` or `REPORT_*`).
6. **Add testers**
   - Invite core QA emails; verify install on Play Store internal track.
7. **Promote to production**
   - After QA + crash-free verification, promote release from internal/closed → production.

## 6. CI expectations
- `.github/workflows/ci.yml` contains `build-android` job (Ubuntu runner) that executes `./gradlew bundleRelease` without secrets to ensure build integrity.
- Smoke tests (`npm run smoke:backend`) run post-build to guarantee API readiness before publishing.

## 6.1 Capacitor mobile shell
- The shipping Android app is currently a Capacitor wrapper located under `mobile-shell/`.
- Update `capacitor.config.ts` (or `ASINU_WEB_URL`) whenever the hosted web URL changes.
- Use helper scripts:
  - `npm run mobile:android:sync`
  - `npm run mobile:android:open`
- Build/release procedures for this shell are documented in `docs/MOBILE_CAPACITOR_ANDROID_RELEASE.md`.

## 7. Checklists
- [ ] Metadata & assets uploaded
- [ ] Data Safety submitted
- [ ] Content Rating approved
- [ ] QA sign-off recorded in `QA_SMOKE.md`
- [ ] Release notes attached to Play Console submission

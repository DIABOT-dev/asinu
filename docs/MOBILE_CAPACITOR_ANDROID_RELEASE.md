# MOBILE_CAPACITOR_ANDROID_RELEASE.md

Capacitor shell for running the Asinu web app inside a native Android wrapper.

## 1. Requirements
- Node.js 20+
- Android Studio + SDK, Java 17
- Access to this repo with `mobile-shell/`
- Target web URL (staging/prod) exported via `ASINU_WEB_URL`

## 2. Prepare the project
```bash
cd mobile-shell
npm install            # first time only
export ASINU_WEB_URL="https://app.asinu.top"   # choose correct env
npm run cap:sync
```

`capacitor.config.ts` reads `ASINU_WEB_URL` to decide which site to load via WebView. No local web build is bundled; the app points directly to the hosted Asinu experience.

## 3. Open Android Studio & build
```bash
npm run cap:open:android
```
Then in Android Studio:
1. Wait for Gradle sync.
2. Connect device or enable emulator.
3. Build > Generate Signed Bundle/APK.
4. Pick `Android App Bundle` for Play Store. When prompted, provide keystore path/password (do **not** commit secrets).

Output artifacts live under `mobile-shell/android/app/build/outputs/`.

## 4. Release checklist
- [ ] `ASINU_WEB_URL` points to staging/prod endpoint.
- [ ] Splash/icon assets updated in `mobile-shell/android/app/src/main/res`.
- [ ] QA smoke run on APK/AAB before uploading to Play Console internal track.
- [ ] Document build number in `REPORT_*.md` or release notes.
- [ ] Use `scripts/sign_mobile_aab.sh` (see `docs/MOBILE_DEPLOY_PLAYSTORE.md`) to sign bundles before upload.

# MOBILE_DEPLOY_PLAYSTORE.md

Checklist for shipping the Capacitor-based Android shell to Google Play.

## 1. Build preparation
1. Navigate to the shell project:
   ```bash
   cd mobile-shell
   npm install
   export ASINU_WEB_URL="https://app.asinu.top"   # override if deploying staging build
   npm run cap:sync
   ```
2. Open Android Studio via `npm run mobile:android:open` (from repo root) or build with Gradle CLI: `cd mobile-shell/android && ./gradlew bundleRelease`.
3. Gradle output lives under `mobile-shell/android/app/build/outputs/bundle/release/`.

## 2. Signing the AAB
Use the helper script `scripts/sign_mobile_aab.sh` from repo root:
```bash
KEYSTORE_PATH=$HOME/keystores/asinu-release.keystore \
KEYSTORE_PASS=*** \
KEY_ALIAS=asinu \
KEY_ALIAS_PASS=*** \
./scripts/sign_mobile_aab.sh mobile-shell/android/app/build/outputs/bundle/release/app-release.aab
```
- The keystore and passwords must stay outside git.
- Script wraps `jarsigner` with SHA256 defaults. Run `zipalign` beforehand if generating APKs.

## 3. Upload to Google Play
1. Go to Google Play Console → Internal testing track.
2. Upload the signed `.aab`.
3. Fill release notes and select testers.
4. After validation and QA, promote to production.

## 4. Post-deploy
- Tag release in git (e.g., `git tag mobile-shell-v0.1.0`).
- Attach QA evidence (crash-free sessions, smoke logs).
- Update `docs/RELEASE_ANDROID.md` or sprint report with build/version numbers.

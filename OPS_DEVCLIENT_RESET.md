## Dev Client: Nuclear Clean

Commands to fully reset Metro/Expo cache before retrying a Hermes dev client build:

```bash
cd ~/asinu
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-* 2>/dev/null || true
export EXPO_USE_WATCHMAN=false
npx expo start --dev-client --clear --port 8081
```

Notes:
- Metro config is picked up from `metro.config.js`; Metro logs should not report missing config.
- `--clear` is used instead of `--reset-cache` (not supported in some Expo CLI versions).
- After this clean, dev client reload should complete and the Hermes compile error should go away; if stale JS persists, uninstall the dev client on the emulator once.

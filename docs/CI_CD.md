# ASINU mobile CI/CD

## CI

`Mobile CI` runs for pull requests and every push to `main`:

- TypeScript type-check.
- Vietnamese/English translation parity.
- Asset reference validation.
- ESLint.
- Expo JavaScript bundle export for iOS and Android.

## CD

`Mobile CD (EAS)` creates native EAS artifacts. It can be started:

- Manually, choosing `development`, `preview`, or `production` and a platform.
- By pushing a `mobile-v*` tag. Tags always build the `production` profile for iOS and Android.

Required GitHub repository secret:

- `EXPO_TOKEN`: Expo access token for the account that owns the EAS project.

The workflow builds artifacts but does not submit them to the stores. Store submission remains a separate, explicit release action.

Example production release:

```bash
git tag mobile-v1.0.1
git push origin mobile-v1.0.1
```

The Expo account must have available iOS/Android build quota when the workflow runs.

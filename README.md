# ASINU Lite (Expo Router)

New ASINU Lite mobile client (Expo Router + TypeScript) that follows `ASINU_LITE_SPEC_v1.1.md`. The legacy app now lives under `archive/mobile-legacy/` and is not used for development.

## Quick start
1. From repo root: `cd apps/asinu-lite`.
2. Install dependencies (requires internet): `npm install`.
3. Run the dev server: `npx expo start --clear --web` (or omit `--web` for native). Set `EXPO_PUBLIC_DEV_BYPASS_AUTH=1` to skip login.
4. Navigate: Splash → Login (or bypass) → Home → Logs (list + quick forms) → FAB quick log → Missions (optimistic complete) → Tree → Profile → Settings → Logout.

> In this environment, registry access is blocked; stub modules for AsyncStorage/Zustand/React Query are provided under `apps/asinu-lite/node_modules` so linting/build steps remain unblocked. Remove them once real installs succeed.

## App structure
```
app/
  _layout.tsx           // Providers + stack shell
  index.tsx             // Splash/bootstrap
  (tabs)/               // Bottom tabs (home, missions, tree, profile)
  logs/                 // Standalone log forms
  login/                // Auth screen
  settings/             // Settings + logout
src/
  components/           // Buttons, inputs, cards, list items, FAB
  ui-kit/               // Ported UI kit components from the template
  features/             // auth, missions, logs, tree, profile, flags
  lib/                  // api client, env, storage, navigation helpers
  providers/            // Session + React Query providers
  styles/               // Theme tokens
```

## Development notes
- **Backend isolation**: never import backend code from `src/` (server). Mobile only calls `/api/mobile/*` via `src/lib/apiClient.ts`.
- **Feature flags**: `src/features/app-config/flags.store.ts` exposes feature toggles for experimental routes.
- **Auth bypass**: `EXPO_PUBLIC_DEV_BYPASS_AUTH=1` will construct a mock profile so Home is reachable without real login.
- **Legacy mobile**: `apps/mobile` is archived; use `apps/asinu-lite` for all active work.

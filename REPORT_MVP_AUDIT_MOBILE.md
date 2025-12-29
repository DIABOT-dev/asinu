# REPORT_MVP_AUDIT_MOBILE

## Executive Summary
- Completion: 83% (5/6 blocks)
- P0 missing: none
- P1 missing: feature flags sourced from /api/auth/verify + Rewards/Family kill switch
- Note: Source file `/mnt/data/ASINU_DIA_BRAIN_LOCKED_v1.0.2.docx` not found in this environment.

## Matrix
| Block | Status | Notes |
| --- | --- | --- |
| BaseURL | DONE | Hard-wired to `https://asinu.top` |
| Auth | DONE | POST `/api/auth/verify` wired in bootstrap + OTP |
| Logs | DONE | POST `/api/mobile/logs` for create flows |
| Chat | DONE | POST `/api/mobile/chat` for send |
| DeleteAccount | DONE | Settings UI + confirm + DELETE `/api/auth/me` |
| Flags | MISSING (P1) | Flags fetched from `/api/mobile/flags`; Rewards/Family missing |

## Evidence
### Base URL (DONE)
- `src/lib/env.ts:2` `apiBaseUrl: 'https://asinu.top'`
  - cmd: `rg -n "apiBaseUrl" src/lib/env.ts`
- `src/lib/apiClient.ts:55` `const url = \`\${env.apiBaseUrl}\${path}\``
  - cmd: `rg -n "env\\.apiBaseUrl" src/lib/apiClient.ts`

### Auth Verify (DONE)
- `src/features/auth/auth.api.ts:30` POST `/api/auth/verify`
  - cmd: `rg -n "/api/auth/verify" src/features/auth/auth.api.ts`
- `src/features/auth/auth.store.ts:43` + `src/features/auth/auth.store.ts:122` usage in bootstrap/OTP
  - cmd: `rg -n "authApi\\.verify" src/features/auth/auth.store.ts`

### Logs (DONE)
- `src/features/logs/logs.api.ts:50` POST `/api/mobile/logs` (create)
- `src/features/logs/logs.api.ts:58` GET `/api/mobile/logs` (fetch)
  - cmd: `rg -n "/api/mobile/logs" src/features/logs/logs.api.ts`

### Chat (DONE)
- `src/features/chat/chat.api.ts:20` POST `/api/mobile/chat`
  - cmd: `rg -n "/api/mobile/chat" src/features/chat/chat.api.ts`

### Delete Account (DONE)
- UI + confirm modal: `app/settings/index.tsx:48` + `app/settings/index.tsx:92`
  - cmd: `rg -n "X�a t�i kho?n" app/settings/index.tsx`
- API call: `src/features/auth/auth.api.ts:42` DELETE `/api/auth/me`
  - cmd: `rg -n "/api/auth/me" src/features/auth/auth.api.ts`

### Feature Flags / Kill Switch (MISSING - P1)
- Flags fetched from `/api/mobile/flags` and only AI-related keys present (no Rewards/Family)
  - cmd: `rg -n "/api/mobile/flags|FEATURE_AI_CHAT" src/features/app-config/flags.api.ts src/features/app-config/flags.store.ts`

### Repo banned strings check (DONE)
- cmd: `rg -n "localhost|10\\.0\\.2\\.2|api\\.diabot\\.top|:8000" -S`
- Result: no matches

## Smoke Test (Runnable)
1. Build & install:
   - `npm run android` or `npx expo run:android`
   - `npx expo run:ios`
2. Disable Wi-Fi, use 4G.
3. Login:
   - Phone login -> OTP screen -> verify -> expect POST `/api/auth/verify` 200.
4. Create logs:
   - Logs -> Glucose/BP/Weight/Medication -> Save -> expect POST `/api/mobile/logs` 200.
5. Chat:
   - Home -> Asinu Chat bubble (or Profile -> AI Chat if enabled) -> expect POST `/api/mobile/chat` 200 + response rendered.

## Action Plan
P0:
- None. Run the smoke test to validate server responses (200 + JSON).

P1:
- Move flags to `/api/auth/verify` response and include Rewards/Family kill switches.
- Extend flags store to support Rewards/Family and enforce UI gating.
- Define fallback behavior when verify fails (defaults OFF).

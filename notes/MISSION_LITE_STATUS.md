# Mission Lite Status – 2025-11-10

## ✅ Delivered
1. **Schema**: `migrations/110_mission_lite.sql` now creates `missions`, `user_missions`, `mission_log` and seeds water / walk / mood.
2. **Backend**:
   - Feature flag `FEATURE_MISSION` + client flag `NEXT_PUBLIC_FEATURE_MISSION`.
   - Dia Brain bridge helper (`src/lib/bridge.ts`) with `mission_done` emitter.
   - APIs `/api/missions/today` + `/api/missions/checkin` using mission service + session cookies.
3. **Frontend**: Dashboard renders “Today’s Missions” checklist (`src/modules/mission/ui/TodayMissions.tsx`) with toast feedback + instant state updates.
4. **Tests**: Added mission utils, bridge emitter, and UI tests (`tests/mission.utils.spec.ts`, `tests/mission.bridge.spec.ts`, `__tests__/modules/mission/TodayMissions.test.tsx`). Full suite: `CI=1 npm test` → PASS (45/45).
5. **Docs**: README instructions for enabling Mission Lite; `docs/ENV_VARS.md` documents `FEATURE_MISSION`, `NEXT_PUBLIC_FEATURE_MISSION`, `BRIDGE_URL`, `BRIDGE_KEY`.
6. **Build**: `npm run build` succeeds (Next 14.2.7). Alias changes + `/api/me` included.

## ⚠️ Outstanding / Follow-up
1. **DB**: Run `migrations/110_mission_lite.sql` on each environment and verify seeds exist (`SELECT code FROM missions`).
2. **Bridge**: Need valid `BRIDGE_URL` + `BRIDGE_KEY`. Currently emits are skipped (`skipped:true`).
3. **Type-check debt**: `npm run type-check` still fails on legacy files (auth/register, Supabase repos, lucide icons, etc.). Not touched today.
4. **Lint warnings**: existing console/unused vars remain (not part of this change).
5. **QA checklist**: Mission Lite endpoints should be added to QA smoke when DB + feature flag enabled.

## Next Session Starting Points
1. Apply migration + smoke `/api/missions/today` and `/api/missions/checkin` against real DB (with `FEATURE_MISSION=true`).
2. Set bridge env vars, observe `mission_done` payloads, and capture logs for Dia Brain team.
3. Start **Family v1** work per AGENTS plan (schema + `/api/family/*` routes) once Mission Lite verified.
4. Plan remediation for `npm run type-check` blockers so CI can go green before PR.

_Reminder: keep `FEATURE_MISSION` off in prod until DB migration + QA confirmation are done._ 

---

## Deployment Log

- **2025-11-11 – Local**
  - Applied `migrations/110_mission_lite.sql` via `docker compose exec asinu-postgres psql` (result: `INSERT 0 3`, `mood/walk/water` present).
  - Service-level smoke (ran inside temporary `node:20` container on `asinu_asinu-network` because host sockets are blocked):
    - `missionService.getTodayMissions(...)` → `["mood","walk","water"]`.
    - First `checkinMission` on `water` → `{ added: 1, status: 'pending', today_summary.energy_earned: 0 }`.
    - Second call within 30s → `{ added: 0 }`, confirming the dedupe guard.
  - Confirmed `mission_log` for `75c75506-c1c8-4f2d-88d2-09d84dacc753` has exactly one row for `water` on `CURRENT_DATE`.
  - Next: replicate the same flow on staging → prod once Dia Brain bridge credentials are available.

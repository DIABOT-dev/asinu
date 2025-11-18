# Asinu Mobile Contracts (P0 Wave)

## 1. Screen Contract Cards (P0)

| Screen ID | Route | Layout | Components / State | Loading & Error | Navigation |
|-----------|-------|--------|--------------------|-----------------|------------|
| splash | `/` | standalone | - `SplashGate` (reads session, feature flags).<br>- Local state: `loading`, `destination`. | Skeleton splash; errors surface as retry prompt (network/error). | Redirect to `/home` (authenticated) or `/auth/login`. |
| auth_login | `/auth/login` | stack | - `EmailInput`, `PasswordInput`, `CTAButton`, `HelpLinks`.<br>- Form state: email, password, remember me, validation errors. | Loading overlay on submit; show server error message. | Navigate to `/auth/otp`, `/legal/terms`, `/home`. |
| auth_otp | `/auth/otp` | stack | - `PhoneInput`, `SendOtpButton`, `OtpCodeInput`, `VerifyButton`, resend timer.<br>- State: phone, code, countdown, status. | Disabled buttons during cooldown, inline error for invalid OTP. | Back to login; forward to `/home` or `/onboarding/profile`. |
| onboarding_profile | `/onboarding/profile` | stack | - `ProfileForm` (name, DOB, goals, timezone).<br>- Optional `AvatarUploader`.<br>- Buttons: Save, Skip. | Show skeleton for defaults; handle server validation errors inline. | Next to `/home`; skip goes to `/home` but flagged for completion later. |
| legal_terms | `/legal/terms` | stack | - `MarkdownViewer` for ToS/Privacy.<br>- `AcceptButton`, `DeclineLink`. | Loading spinner while fetching markdown; failure shows retry. | Accept -> return to previous; decline -> logout/auth. |
| home_dashboard | `/home` | tab | - Cards: Missions, Tree Level, Energy, Rewards CTA, Donate CTA.<br>- `MissionMiniList`, `EnergyMeter`, `DonationHighlight`. | Pull-to-refresh; placeholder skeleton cards until data loads. | Buttons route to `/missions`, `/tree`, `/rewards`, `/donate`. |
| mission_today | `/missions` | tab | - `MissionChecklist` list.<br>- Each row: title, cluster, reward, action button.<br>- Filters (optional). | Shimmer rows; toast on errors. | Detail tap -> `/missions/[id]`. |
| mission_detail | `/missions/[id]` | stack | - Header (title, description, sponsor).<br>- Progress timeline, log entries, CTA button.<br>- Share button. | Loading indicator until mission details arrive; handle 404 by fallback screen. | Back to `/missions`; share opens OS share sheet. |
| tree_overview | `/tree` | tab | - `TreeCanvas` (visualization).<br>- Stats chips (level, energy, badges).<br>- CTA to events/history. | Use cached state from home if available; degrade to summary text if canvas fails. | `See events` -> `/tree/events`. |
| rewards_overview | `/rewards` | tab | - `BalanceCard`, `CatalogGrid`, `FeaturedSponsor`. | Show placeholder grid; toast errors. | Select item -> `/rewards/[id]`. |
| reward_detail | `/rewards/[id]` | stack | - Item hero, description, cost, sponsor, CTA.<br>- Terms & conditions section. | Loading spinner; disable CTA while redeeming. | On success, push confirmation modal or navigate to `/rewards/history`. |
| donate_overview | `/donate` | tab | - Intro copy, stats, quick donate shortcuts.<br>- History snippet. | Show fallback when donation disabled. | CTA -> `/donate/do`; history -> `/donate/history`. |
| donate_flow | `/donate/do` | stack | - Stepper (choose provider, amount, confirm).<br>- Form state: provider, amount points, amount VND, note. | Validations inline; show redirect instructions for VNPay/MoMo. | Completion -> `/donate/history`; cancel -> `/donate`. |
| family_overview | `/family` | tab | - Member list, pending invites, action banner.<br>- Buttons: Invite, View Member. | Empty state when no members; error toast. | Invite -> `/family/invite`; member -> `/family/[id]`. |
| profile_overview | `/profile` | tab | - Avatar, name, energy, preferences list, shortcuts (settings, logs). | Prefetch profile from home. | Settings -> `/settings`; logs -> `/logs`. |
| settings | `/settings` | stack | - Toggles (notifications, AI), account info, logout button. | Provide optimistic toggle states; fallback message for failure. | Link to `/legal/terms`, `/offline`. |
| offline | `/offline` | stack | - Offline illustration, retry button, support link. | Local-only; no remote data. | Retry triggers network probe, returns previous route. |

---

## 2. API Interface Table (P0 endpoints)

| Endpoint | Method | Description | Request Shape | Response Shape | Error Codes |
|----------|--------|-------------|---------------|----------------|-------------|
| `/api/mobile/session` | GET | Return current session, user, and feature flags. | — | `{ ok, data: { user, featureFlags, env } }` | 401 (no session), 500 |
| `/api/mobile/auth/login` | POST | Email/password authentication. | `{ email, password }` | `{ ok, data: { session_id, user } }` | 400 (validation), 401 (invalid), 423 (locked) |
| `/api/mobile/auth/otp/send` | POST | Send OTP code. | `{ phone }` | `{ ok, data: { expires_at } }` | 400 (invalid phone), 429 (rate limit) |
| `/api/mobile/auth/otp/verify` | POST | Verify OTP code. | `{ phone, otp }` | `{ ok, data: { session_id, user } }` | 400 (wrong OTP), 410 (expired) |
| `/api/mobile/profile/template` | GET | Prefill profile metadata. | — | `{ ok, data: { goals, timezones } }` | 500 |
| `/api/mobile/profile` | GET / PUT | Fetch/update profile. | GET: —<br>PUT: `{ name, dob, goal, timezone, ... }` | `{ ok, data: profile }` | 400, 401 |
| `/api/mobile/legal/terms` | GET | Terms markdown & version. | — | `{ ok, data: { version, content } }` | 500 |
| `/api/mobile/dashboard` | GET | Aggregate KPIs for home. | — | `{ ok, data: { missions, energy, tree, donate } }` | 401, 500 |
| `/api/mobile/missions/today` | GET | Mission checklist. | — | `{ ok, data: { missions, summary } }` | 401, 500 |
| `/api/mobile/missions/{id}` | GET | Mission detail. | — | `{ ok, data: mission }` | 404, 500 |
| `/api/mobile/missions/checkin` | POST | Complete mission. | `{ mission_id }` | `{ ok, data: { status, summary } }` | 400, 401, 409 |
| `/api/mobile/tree/state` | GET | Tree summary (level, energy). | — | `{ ok, data: treeState }` | 401, 500 |
| `/api/mobile/tree/events` | GET | Tree event timeline. | `?cursor` | `{ ok, data: { events, next_cursor } }` | 401, 500 |
| `/api/mobile/rewards/catalog` | GET | Reward items. | — | `{ ok, data: { items } }` | 401, 500 |
| `/api/mobile/rewards/{id}` | GET | Reward detail. | — | `{ ok, data: item }` | 404, 500 |
| `/api/mobile/rewards/redeem` | POST | Redeem item. | `{ item_id }` | `{ ok, data: redemption }` | 400, 401, 409 |
| `/api/mobile/rewards/balance` | GET | VP balance. | — | `{ ok, data: { balance } }` | 401, 500 |
| `/api/mobile/rewards/history` | GET | Redemption history. | `?cursor,status` | `{ ok, data: { entries, next_cursor } }` | 401, 500 |
| `/api/mobile/donate/options` | GET | Donation presets. | — | `{ ok, data: { presets, providers } }` | 401 |
| `/api/mobile/donate/intent` | POST | Start donate flow. | `{ provider, amount_points?, amount_vnd?, note? }` | `{ ok, data: { intent_id, redirect_url } }` | 400, 401 |
| `/api/mobile/donate/history` | GET | Donation history. | `?cursor` | `{ ok, data: { entries, next_cursor } }` | 401 |
| `/api/mobile/family` | GET | Family roster. | — | `{ ok, data: { members, invites } }` | 401 |
| `/api/mobile/family/{id}` | GET | Member detail. | — | `{ ok, data: member }` | 404, 401 |
| `/api/mobile/family/invite` | POST | Create invite. | `{ channel, note? }` | `{ ok, data: { invite_code, expires_at } }` | 400 |
| `/api/mobile/family/invite/accept` | POST | Accept invite. | `{ invite_code }` | `{ ok, data: { family } }` | 400, 410 |
| `/api/mobile/profile/preferences` | GET/PUT | Preference toggles. | GET: —<br>PUT: `{ preference_key, value }` | `{ ok, data: preferences }` | 400 |
| `/api/mobile/settings` | GET | App/server settings snapshot. | — | `{ ok, data: settings }` | 401 |
| `/api/mobile/logs/summary` | GET | Latest log entries summary. | — | `{ ok, data: { bg, bp, weight, meal } }` | 401 |
| `/api/mobile/logs` | POST | Create new log entry (BG/BP/etc.). | `{ type, payload }` | `{ ok, data: log }` | 400 |
| `/api/mobile/notifications` | GET | Notices feed. | `?cursor` | `{ ok, data: { notifications, next_cursor } }` | 401 |
| `/api/mobile/app-status` | GET | Maintenance message. | — | `{ ok, data: { status, message } }` | 200 even on maintenance flag |

> NOTE: `/api/mobile/*` naming is placeholder – align with server conventions before implementation.

---

## 3. Action → Side-effects Matrix (P0 focus)

| Action | Endpoint / Method | Cache Impact | Analytics / Dia Brain | Notes |
|--------|-------------------|--------------|------------------------|-------|
| `hydrateSession` | GET `/api/mobile/session` | Populate `session` store; prime feature flags. | Analytics: `app_open`, DB: — | Runs at splash. |
| `submitCredentials` | POST `/api/mobile/auth/login` | Update `session` store, invalidate `session` query. | Analytics: `auth_login_attempt`, `auth_login_success`/`_fail`. | On fail show toast. |
| `sendOtp` | POST `/api/mobile/auth/otp/send` | — | Analytics: `auth_otp_send`. | Start resend timer. |
| `verifyOtp` | POST `/api/mobile/auth/otp/verify` | Set session, refetch dashboard. | Analytics: `auth_otp_verify`. | | 
| `saveProfile` | PUT `/api/mobile/profile` | Invalidate `profile`, `dashboard`. | Analytics: `profile_complete`. | |
| `acceptTerms` | POST `/api/mobile/legal/accept` (if needed) | Update `session.legalAccepted`. | Analytics: `legal_accept`. | |
| `refreshDashboard` | GET `/api/mobile/dashboard` | Refresh `home` queries. | Analytics: `dashboard_refresh`. | |
| `completeMission` | POST `/api/mobile/missions/checkin` | Invalidate `missions.today`, `dashboard`, `rewards.balance`. | Analytics: `mission_complete`; Dia Brain event `mission_done`. | Optimistic update for checklist row. |
| `openMissionDetail` | GET `/api/mobile/missions/{id}` | Cache mission detail; reuse for history. | Analytics: `mission_detail_view`. | |
| `redeemReward` | POST `/api/mobile/rewards/redeem` | Invalidate `rewards.balance`, `rewards.catalog`, `rewards.history`. | Analytics: `reward_redeem`; Dia Brain `reward_redeem`. | Provide confirmation toast. |
| `startDonateIntent` | POST `/api/mobile/donate/intent` | Update `donateHistory` after confirmation. | Analytics: `donate_start`; Dia Brain `donate` once success. | Might require external URL redirect. |
| `submitDonateIntent` | POST `/api/mobile/donate/intent` (final commit) | Invalidate `donate.history`, `rewards.balance`. | Analytics: `donate_complete`; Dia Brain `donate`. | Support both VP and cash. |
| `createInvite` | POST `/api/mobile/family/invite` | Invalidate `family` list/invites. | Analytics: `family_invite_create`. | |
| `acceptInvite` | POST `/api/mobile/family/invite/accept` | Refresh `family`. | Analytics: `family_invite_accept`; Dia Brain `invite_accept`. | |
| `editProfile` | PUT `/api/mobile/profile` | Same as `saveProfile`. | Analytics: `profile_update`. | |
| `toggleFeature` | PUT `/api/mobile/profile/preferences` | Update local preferences store. | Analytics: `settings_toggle_<flag>`. | |
| `logout` | POST `/api/mobile/auth/logout` | Clear caches (`session`, `dashboard`). | Analytics: `auth_logout`. | |
| `submitLog` | POST `/api/mobile/logs` | Invalidate `logs.summary`, `dashboard`. | Analytics: `log_create`. | |
| `markNotificationRead` | POST `/api/mobile/notifications/{id}/read` | Update notifications cache. | Analytics: `notification_read`. | |
| `retryConnection` | Local only | Re-run last failed queries. | Analytics: `offline_retry`. | |

> Extend this matrix for P1/P2 actions (mission_history filters, AI chat) when those waves are scheduled.

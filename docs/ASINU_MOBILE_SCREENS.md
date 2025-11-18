# Asinu Mobile Screen Architecture

## Shell & Navigation

- **Router**: Expo Router (App Router v3) hosted under `apps/mobile/app/`.
- **Root layout**:
  - Bottom tab navigator with primary tabs: `Home (/home)`, `Missions (/missions)`, `Tree (/tree)`, `Rewards (/rewards)`, `Family (/family)`, `Profile (/profile)`.
  - Secondary stack screens push on top of these tabs (detail, history, legal, auth, etc.).
- **Template usage**: the purchased Expo template provides UI primitives (buttons, cards, typography) only. No routing or data layer is reused verbatim.
- **Data access**: all network traffic flows through a shared client `apps/mobile/lib/api/asinu.ts` (wrapping fetch/React Query). Individual screens import hooks/services, not `fetch` calls.

---

## P0 – Wave 1

### splash
- **ID**: `splash`
- **Route**: `/`
- **Priority**: `P0`
- **Purpose**: Startup gate – load tokens, feature flags, and route to home/auth.
- **Data**:
  - `/api/mobile/session` (current session & feature flags)
  - `/api/mobile/app-config` (remote config if available)
- **Actions**:
  - `hydrateSession`
  - `navigateToAuthOrHome`

### auth_login
- **ID**: `auth_login`
- **Route**: `/auth/login`
- **Priority**: `P0`
- **Purpose**: Email/password login entry.
- **Data**:
  - `/api/mobile/auth/login`
  - `/api/mobile/auth/config` (password policies)
- **Actions**:
  - `submitCredentials`
  - `resetPasswordLink`

### auth_otp
- **ID**: `auth_otp`
- **Route**: `/auth/otp`
- **Priority**: `P0`
- **Purpose**: Phone OTP send + verify.
- **Data**:
  - `/api/mobile/auth/otp/send`
  - `/api/mobile/auth/otp/verify`
- **Actions**:
  - `sendOtp`
  - `verifyOtp`

### onboarding_profile
- **ID**: `onboarding_profile`
- **Route**: `/onboarding/profile`
- **Priority**: `P0`
- **Purpose**: Collect minimum profile data for first-time users.
- **Data**:
  - `/api/mobile/profile/template`
  - `/api/mobile/profile` (POST/PUT)
- **Actions**:
  - `saveProfile`
  - `skipOnboarding`

### legal_terms
- **ID**: `legal_terms`
- **Route**: `/legal/terms`
- **Priority**: `P0`
- **Purpose**: Show ToS / privacy; confirm consent.
- **Data**:
  - `/api/mobile/legal/terms`
- **Actions**:
  - `acceptTerms`
  - `openPrivacyLink`

### home_dashboard
- **ID**: `home_dashboard`
- **Route**: `/home`
- **Priority**: `P0`
- **Purpose**: Summary cards (missions, streaks, energy, donate CTA).
- **Data**:
  - `/api/mobile/dashboard`
  - `/api/mobile/missions/today`
  - `/api/mobile/rewards/summary`
- **Actions**:
  - `openMissionChecklist`
  - `startDonateIntent`
  - `refreshDashboard`

### mission_today
- **ID**: `mission_today`
- **Route**: `/missions`
- **Priority**: `P0`
- **Purpose**: Daily mission checklist with live status.
- **Data**:
  - `/api/mobile/missions/today`
- **Actions**:
  - `completeMission`
  - `refreshMissions`

### mission_detail
- **ID**: `mission_detail`
- **Route**: `/missions/[id]`
- **Priority**: `P0`
- **Purpose**: Mission description, progress, sponsor info.
- **Data**:
  - `/api/mobile/missions/{id}`
  - `/api/mobile/missions/{id}/log`
- **Actions**:
  - `completeMission`
  - `shareMission`

### tree_overview
- **ID**: `tree_overview`
- **Route**: `/tree`
- **Priority**: `P0`
- **Purpose**: Visual Life Tree state (level, energy, badges).
- **Data**:
  - `/api/mobile/tree/state`
  - `/api/mobile/tree/summary`
- **Actions**:
  - `openTreeEvents`
  - `refreshTree`

### rewards_overview
- **ID**: `rewards_overview`
- **Route**: `/rewards`
- **Priority**: `P0`
- **Purpose**: Catalog and wallet balance.
- **Data**:
  - `/api/mobile/rewards/catalog`
  - `/api/mobile/rewards/balance`
- **Actions**:
  - `openRewardDetail`
  - `redeemQuickAction`

### reward_detail
- **ID**: `reward_detail`
- **Route**: `/rewards/[id]`
- **Priority**: `P0`
- **Purpose**: Item details + redeem confirmation.
- **Data**:
  - `/api/mobile/rewards/{id}`
  - `/api/mobile/rewards/balance`
- **Actions**:
  - `redeemReward`
  - `shareReward`

### donate_overview
- **ID**: `donate_overview`
- **Route**: `/donate`
- **Priority**: `P0`
- **Purpose**: Describe donation options, show history summary.
- **Data**:
  - `/api/mobile/donate/options`
  - `/api/mobile/donate/summary`
- **Actions**:
  - `startDonateIntent`
  - `openDonateFlow`

### donate_flow
- **ID**: `donate_flow`
- **Route**: `/donate/do`
- **Priority**: `P0`
- **Purpose**: Guided pledge (points or VND).
- **Data**:
  - `/api/mobile/donate/intent`
  - `/api/mobile/donate/providers`
- **Actions**:
  - `submitDonateIntent`
  - `trackDonateStatus`

### family_overview
- **ID**: `family_overview`
- **Route**: `/family`
- **Priority**: `P0`
- **Purpose**: Member list, invite entry.
- **Data**:
  - `/api/mobile/family`
  - `/api/mobile/family/invites`
- **Actions**:
  - `openInvite`
  - `viewFamilyMember`

### profile_overview
- **ID**: `profile_overview`
- **Route**: `/profile`
- **Priority**: `P0`
- **Purpose**: Personal info, stats, quick links.
- **Data**:
  - `/api/mobile/profile`
  - `/api/mobile/profile/preferences`
- **Actions**:
  - `editProfile`
  - `openSettings`

### settings
- **ID**: `settings`
- **Route**: `/settings`
- **Priority**: `P0`
- **Purpose**: App settings, feature toggles, logout.
- **Data**:
  - `/api/mobile/settings`
- **Actions**:
  - `toggleFeature`
  - `logout`

### offline
- **ID**: `offline`
- **Route**: `/offline`
- **Priority**: `P0`
- **Purpose**: Show offline state & retry.
- **Data**: — (local only)
- **Actions**:
  - `retryConnection`
  - `openTroubleshooting`

---

## P1 – Wave 2

### mission_history
- **ID**: `mission_history`
- **Route**: `/missions/history`
- **Priority**: `P1`
- **Purpose**: Past mission log with filters.
- **Data**:
  - `/api/mobile/missions/history`
- **Actions**:
  - `filterByDate`
  - `openMissionDetail`

### tree_events
- **ID**: `tree_events`
- **Route**: `/tree/events`
- **Priority**: `P1`
- **Purpose**: Chronological list of tree changes.
- **Data**:
  - `/api/mobile/tree/events`
- **Actions**:
  - `filterByType`
  - `shareEvent`

### reward_history
- **ID**: `reward_history`
- **Route**: `/rewards/history`
- **Priority**: `P1`
- **Purpose**: Redeem/earn history.
- **Data**:
  - `/api/mobile/rewards/history`
- **Actions**:
  - `filterByStatus`
  - `openRewardDetail`

### donate_history
- **ID**: `donate_history`
- **Route**: `/donate/history`
- **Priority**: `P1`
- **Purpose**: Donations log.
- **Data**:
  - `/api/mobile/donate/history`
- **Actions**:
  - `filterByCampaign`
  - `exportReceipt`

### family_member
- **ID**: `family_member`
- **Route**: `/family/[id]`
- **Priority**: `P1`
- **Purpose**: Member profile + stats.
- **Data**:
  - `/api/mobile/family/{id}`
  - `/api/mobile/family/{id}/missions`
- **Actions**:
  - `requestUpdate`
  - `sendInviteReminder`

### family_invite
- **ID**: `family_invite`
- **Route**: `/family/invite`
- **Priority**: `P1`
- **Purpose**: Generate or accept invites.
- **Data**:
  - `/api/mobile/family/invite`
  - `/api/mobile/family/invite/accept`
- **Actions**:
  - `createInvite`
  - `shareInvite`
  - `acceptInvite`

### logs_overview
- **ID**: `logs_overview`
- **Route**: `/logs`
- **Priority**: `P1`
- **Purpose**: Unified log dashboard (bg, bp, weight, meal).
- **Data**:
  - `/api/mobile/logs/summary`
  - `/api/mobile/logs/latest`
- **Actions**:
  - `openLogDetail`
  - `navigateToAddLog`

### logs_add
- **ID**: `logs_add`
- **Route**: `/logs/add`
- **Priority**: `P1`
- **Purpose**: Record new measurement (BG/BP/etc.).
- **Data**:
  - `/api/mobile/logs/templates`
  - `/api/mobile/logs` (POST)
- **Actions**:
  - `submitLog`
  - `uploadPhoto`

### notifications
- **ID**: `notifications`
- **Route**: `/notifications`
- **Priority**: `P1`
- **Purpose**: In-app notice center.
- **Data**:
  - `/api/mobile/notifications`
- **Actions**:
  - `markAsRead`
  - `openNotificationLink`

---

## P2 – Wave 3

### ai_chat
- **ID**: `ai_chat`
- **Route**: `/ai`
- **Priority**: `P2`
- **Purpose**: Conversational AI coach.
- **Data**:
  - `/api/mobile/ai/chat/history`
  - `/api/mobile/ai/chat/send`
- **Actions**:
  - `sendMessage`
  - `rateResponse`

### ai_tip
- **ID**: `ai_tip`
- **Route**: `/ai/tip`
- **Priority**: `P2`
- **Purpose**: Single-tip feed or carousel.
- **Data**:
  - `/api/mobile/ai/tip`
  - `/api/mobile/missions/today` (context)
- **Actions**:
  - `saveTip`
  - `requestAnotherTip`

### maintenance
- **ID**: `maintenance`
- **Route**: `/maintenance`
- **Priority**: `P2`
- **Purpose**: Display maintenance/outage info.
- **Data**:
  - `/api/mobile/app-status`
- **Actions**:
  - `retryStatus`
  - `openSupport`

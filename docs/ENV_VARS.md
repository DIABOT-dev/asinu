# Environment Variables

| Name | Required | Default | Description |
| ---- | -------- | ------- | ----------- |
| `DATABASE_URL` / `DIABOT_DB_URL` | Yes | – | PostgreSQL connection string used by API routes and background jobs. |
| `PG_SCHEMA` | Optional | `asinu_app` | Override primary schema when constructing `DATABASE_URL`; defaults to `asinu_app`. |
| `AUTH_SECRET` / `SESSION_SECRET` | Yes | – | Secret used to sign `asinu.sid` session cookies. |
| `SESSION_TTL_SECONDS` | Optional | `604800` | Session lifetime in seconds; controls cookie max-age and DB session expiry. |
| `OTP_TTL_SECONDS` | Optional | `300` | Time-to-live (seconds) for phone OTP entries in `auth_otp_store`. |
| `OTP_STATIC_VALUE` | Optional | `123456` | Static OTP value for internal testing; replace when real gateway is connected. |
| `FEATURE_MISSION` | Optional | `false` | Enables Mission Lite APIs (`/api/missions/*`) on the server. |
| `NEXT_PUBLIC_FEATURE_MISSION` | Optional | `false` | Toggles Mission Lite UI on the client (Dashboard checklist). |
| `RELATIVE_ENABLED` | Optional | `false` | Enables FamilyLink/relative APIs (`/api/relative/*`); keep `false` until the module ships. |
| `REWARDS_ENABLED` | Optional | `false` | Enables Rewards and Donate APIs (`/api/rewards/*`, `/api/donate`). |
| `NEXT_PUBLIC_REWARDS` | Optional | `false` | Client flag that reveals the Rewards UI; should mirror `REWARDS_ENABLED`. |
| `DONATION_ENABLED` | Optional | `false` | Allows `/api/donate` to be called; leave `false` for MVP so rewards stay free. |
| `NEXT_PUBLIC_DONATION` | Optional | `false` | Shows the donation UI buttons on the client; keep aligned with `DONATION_ENABLED`. |
| `BRIDGE_URL` | Optional | – | Dia Brain Bridge endpoint; when set, mission events are POSTed here. |
| `BRIDGE_KEY` | Optional | – | Bearer key for Dia Brain Bridge requests. |
| `BRIDGE_HASH_SECRET` | Optional | – | Secret used to anonymize user ids before emitting bridge events (defaults to `AUTH_SECRET`). |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional | – | Google OAuth client id used by `/api/auth/google`. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | – | Google OAuth client secret used to exchange tokens. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional | Derived from request URL | Override callback URL for Google OAuth (defaults to `/api/auth/google`). |
| `ZALO_OAUTH_APP_ID` | Optional | – | Zalo OAuth app id used by `/api/auth/zalo`. |
| `ZALO_OAUTH_APP_SECRET` | Optional | – | Zalo OAuth app secret for token exchange. |
| `ZALO_OAUTH_REDIRECT_URI` | Optional | Derived from request URL | Override callback URL for Zalo OAuth (defaults to `/api/auth/zalo`). |
| `TREE_ENABLED` | Optional | `false` | Enables the Life Tree ledger/API (`/api/tree/state`) and point-award helper. |
| `DONATION_PORTAL_URL` | Optional | `https://asinu.ai/donate` | Base URL used to generate VNPay/MoMo donation deep links returned by `/api/donate`. |

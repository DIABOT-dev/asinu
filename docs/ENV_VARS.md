# Environment Variables

| Name | Required | Default | Description |
| ---- | -------- | ------- | ----------- |
| `DATABASE_URL` / `DIABOT_DB_URL` | Yes | – | PostgreSQL connection string used by API routes and background jobs. |
| `PG_SCHEMA` | Optional | `asinu_app` | Override primary schema when constructing `DATABASE_URL`; defaults to `asinu_app`. |
| `AUTH_SECRET` / `SESSION_SECRET` | Yes | – | Secret used to sign `asinu.sid` session cookies. |
| `FEATURE_MISSION` | Optional | `false` | Enables Mission Lite APIs (`/api/missions/*`) on the server. |
| `NEXT_PUBLIC_FEATURE_MISSION` | Optional | `false` | Toggles Mission Lite UI on the client (Dashboard checklist). |
| `BRIDGE_URL` | Optional | – | Dia Brain Bridge endpoint; when set, mission events are POSTed here. |
| `BRIDGE_KEY` | Optional | – | Bearer key for Dia Brain Bridge requests. |
| `BRIDGE_HASH_SECRET` | Optional | – | Secret used to anonymize user ids before emitting bridge events (defaults to `AUTH_SECRET`). |

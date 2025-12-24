# ASINU TECHNICAL RULES (DO NOT VIOLATE)

## 1. Core Stack
- **Runtime:** Node.js >= 20.11 (Strict), npm (pinned versions).
- **Backend:** Next.js 14.2.7 (App Router).
- **Mobile:** Expo (React Native), Expo Router. Path: `apps/asinu-lite`.
- **Database:** Postgres 15 (Dockerized).
- **AI/Python:** Python 3.10+ (cho Dia Brain).

## 2. Infrastructure & Docker
- Docker Compose: `docker-compose.production.yml`.
- Health Checks: `/api/healthz`, `/api/qa/selftest`.
- Ports: Web (3000), DB (5432), Mobile Dev (8081).

## 3. Coding Standards
- **Language:** TypeScript (Strict Mode).
- **Commits:** Conventional Commits (feat, fix, chore, docs).
- **Safety:** KHÔNG hardcode secrets. Dùng `.env`.
- **Decoupling:** Mobile App phải có fallback data nếu Backend offline.

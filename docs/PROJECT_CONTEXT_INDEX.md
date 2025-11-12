# DIABOT Project Context Index

## 1. Codebase Structure Overview
- Clean architecture layering across `domain`, `application`, `infrastructure`, and `interfaces/UI` modules; Next.js app organized under `src/app`, `modules`, `shared`, `lib`, and `types` with cross-module imports restricted to shared utilities. 【F:docs/DIABOT_Master_Spec_V5.md†L60-L95】【F:docs/docs/tech/CODE_STRUCTURE.md†L1-L24】
- Storage integrations now route through the Viettel client proxy in `src/infrastructure/storage/viettel_client.ts`, với các tham chiếu BaaS cũ được theo dõi trong Bolt migration log. 【F:src/infrastructure/storage/viettel_client.ts†L1-L143】【F:docs/tech/MIGRATION_FROM_BOLT.md†L1-L78】

## 2. Specifications & Feature Flags (Context Only)
- **FamilyLink (`RELATIVE_ENABLED`)**: Relatives can view/log data through dedicated API endpoints, RLS policies, and UI toggles; currently dormant pending official activation plan. 【F:docs/FAMILYLINK.md†L1-L168】
- **Proactive Nudge (`NUDGE_ENABLED`)**: Rule-based nudges with safety guardrails and tracking; remains off until directed by DIABOT Team. 【F:docs/PROACTIVE_NUDGE.md†L1-L214】
- Core MVP scope covers logging, dashboards, reminders, AI demo mode, exports, and QA/security baselines established in Master Spec V5. 【F:docs/DIABOT_Master_Spec_V5.md†L8-L214】

## 3. Platform & Operations
- CI/CD pipeline enforces lint → test → build → smoke with commit conventions and branch flow `gpt-dev → gpt-control → main`; GPT commits only on `gpt-dev`. 【F:docs/docs/gpt/README_DEV_FLOW.md†L1-L12】【F:docs/docs/tech/CI_RULES.md†L1-L34】
- Deployment leverages Docker images on Viettel Cloud with environment stewardship, smoke checks, and security guardrails forbidding direct secret handling or external DB access. 【F:docs/DIABOT_Master_Spec_V5.md†L214-L245】【F:docs/docs/tech/SECURITY_CHECKLIST.md†L1-L16】

## 4. Integrations & Utilities
- DIA BRAIN API Gateway exposes `/api/ai/healthz`, `/api/ai/v1/predict/bg_next`, and `/api/qa/selftest` for health checks and predictions; no new automation initiated. 【F:docs/docs/api/API_GATEWAY.md†L1-L18】
- Shared utility inventory tracked under `src/shared/utils` for date, math, string, fetch, and form validation helpers—extend by adding new files and updating reference when instructed. 【F:src/shared/styles/docs/UTILS_REFERENCE.md†L1-L11】

## 5. Document Inventory
- DIABOT Master Specification V5 (comprehensive product spec)
- FamilyLink Feature Spec (relative collaboration)
- Proactive Nudge Spec (contextual reminders)
- API Gateway Notes (AI integration)
- GPT Development Flow & Transition Report (process governance)
- Tech References: CI rules, code structure, security checklist, archive policy, storage policy 【F:docs/docs/tech/CI_RULES.md†L1-L34】【F:docs/docs/tech/CODE_STRUCTURE.md†L1-L24】【F:docs/docs/tech/SECURITY_CHECKLIST.md†L1-L16】【F:docs/tech/ARCHIVE_POLICY.md†L1-L45】【F:docs/tech/STORAGE_POLICY.md†L1-L49】
- Shared Utils Reference (utility registry) 【F:src/shared/styles/docs/UTILS_REFERENCE.md†L1-L11】
- Placeholder DOCX (legacy artifact, no actionable content) 【F:docs/DIABOT_Master_Spec_V5.docx†L1-L1】
- Bolt Migration Log (maps archived artifacts) 【F:docs/tech/MIGRATION_FROM_BOLT.md†L1-L106】

## 6. Current GPT Status
- Context reset completed; awaiting official tasking before initiating FamilyLink, QA, or Gateway follow-up work.
- Ready to receive formal execution plan from DIABOT Team.

## 7. Bolt Sunset – Archive Map
- Legacy BaaS migrations and ADR moved to `archive/bolt_legacy/2025-10-09/` with a four-week retention window before deletion. 【F:docs/tech/MIGRATION_FROM_BOLT.md†L60-L106】【F:archive/README.md†L1-L14】
- Archive-first workflow codified in `docs/tech/ARCHIVE_POLICY.md`, including recovery and purge guidance. 【F:docs/tech/ARCHIVE_POLICY.md†L1-L45】

## 8. Viettel Storage Integration – Client Proxy
- `viettel_client.ts` proxies `putObject`, `getObject`, and `deleteObject` calls through the DIA BRAIN storage gateway; signed URL support is tracked as a TODO. 【F:src/infrastructure/storage/viettel_client.ts†L1-L143】
- Storage policy enforces path conventions for meals, avatars, and reports, plus DIA BRAIN-mediated backups and retention. 【F:docs/tech/STORAGE_POLICY.md†L16-L49】

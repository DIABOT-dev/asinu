# Repository Guidelines

## Project Structure & Module Organization
- `src/` carries domain modules (`modules`, `usecases`, `interfaces`, `infra`), shared UI in `components/`, and global styles in `styles/`.
- Routes and layouts live in the Next.js App Router at `app/`; static assets belong in `public/`, shared libs in `packages/`.
- Agent manifests reside in `agents/`; operational scripts and configs are in `ops/`, reference docs in `docs/`, QA playbooks in `QA/`.
- Tests mirror product code in `__tests__/`, scenario scripts in `tests/` and `e2e/`, with migration SQL in `migrations/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server with hot reload; fix warnings before committing.
- `npm run build` creates a production bundle; prefer `npm run build:ci` in CI to disable telemetry caches.
- Quality gates: `npm run lint`, `npm run type-check`, and `npm run smoke`; `npm run checkpoint` runs the full preflight stack.
- Tests: `npm run test` for Vitest suites, `npm run test:e2e` for Playwright flows, plus targeted health checks (`npm run auth:check`, `npm run meal:check`) when APIs change.

## Coding Style & Naming Conventions
- TypeScript + React with 2-space indentation and imports grouped library → alias → relative.
- Favor functional components, hooks, and colocated helpers inside the owning domain folder.
- ESLint (`eslint.config.js`) and Tailwind guard layout; Husky + lint-staged run `eslint --fix` and `npm run type-check` on staged files.
- Use PascalCase for components, camelCase for utilities, and suffix `.client.tsx` or `.server.ts` when runtime boundaries matter.

## Testing Guidelines
- Unit and integration specs use `.test.ts(x)` files near the subject (e.g., `__tests__/components/Button.test.tsx`); run via `npm run test`.
- UI regressions and onboarding flows live in Playwright suites under `e2e/`; run with `npm run test:e2e`.
- Keep fixtures in `__tests__/fixtures` or `tests/fixtures`, mocking Postgres adapters and external calls.
- Aim for meaningful coverage of happy and failure paths; update smoke scripts when endpoints or env requirements shift.

## Commit & Pull Request Guidelines
- Follow Conventional Commit syntax (`type(scope): summary`); Husky enforces it through `@commitlint/config-conventional`.
- Keep commits focused and descriptive; squash WIP noise before opening a PR.
- PRs outline motivation, linked Jira/GitHub issues, and test evidence (`npm run checkpoint` or equivalent logs); attach screenshots or clips for UI updates.

## Environment & Configuration Notes
- Copy environment templates with `npm run env:sync`, store secrets outside Git, and keep runtime overrides in `ops/` or deployment manifests.
- Use `docker-compose.yml` for local parity; rebuild containers with `npm run docker:build` and `npm run docker:up` when backend contracts change.

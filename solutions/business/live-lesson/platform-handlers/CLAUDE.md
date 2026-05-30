# `@kedge-agentic/live-lesson-platform-handlers`

In-process bundle of live-lesson-specific extensions that the ccaas
backend (`@kedge-agentic/backend`) loads at boot. Carved out of core
in **Phase 5.5** so `@kedge-agentic/backend` itself is genuinely
solution-free — its source + dist contain zero live-lesson references.

## What's inside

| Subpath | Purpose |
|---|---|
| `src/constants.ts` | `LIVE_LESSON_TENANT_SLUG` + workflow namespace constants |
| `src/ontology/` | `LessonSessionManifest` + `LiveLessonOntologyService` (registers manifest + ActionDef toolkits into platform's `OntologyRegistry` + `SolutionToolkitRegistry` at `onModuleInit`) |
| `src/workflow-handlers/lifecycle/` | M2 — student_joined / leave / discuss_complete / translate / continue_chat triggers + action handler |
| `src/workflow-handlers/exercise/` | M3 — student_submitted trigger + exercise observation writer |
| `src/workflow-handlers/progress/` | M3 — step_completed trigger + progress observation writer |
| `src/workflow-handlers/chat-turn/` | M4 — chat_turn trigger + LLM indicator classifier |
| `src/workflow-handlers/status-change/` | M4 — student_observation_changed cascade trigger + LLM status derivation |
| `src/workflow-handlers/dashboard/` | M5 — `DashboardService` + `DashboardController` (`/dashboard`) + M3 legacy `ObservationDashboardProjector` + `ObservationDashboardController` (`/observation-dashboard`) |
| `src/live-lesson-platform-handlers.module.ts` | Aggregator NestJS module — exported as the package's primary surface |
| `test/setup/test-database.ts` | TypeORM test helper for handler specs (imports platform entities via `@kedge-agentic/backend/*`) |

## How the loader finds this package

`packages/backend/src/main.ts` reads the `PLATFORM_HANDLER_PACKAGES`
env var (CSV of package names). For each name it does
`await import(name)` and scans the package's named exports for a
class whose name ends in `Module` (case-sensitive). The first match
wins. This package exports exactly one such class —
`LiveLessonPlatformHandlersModule`.

```bash
PLATFORM_HANDLER_PACKAGES=@kedge-agentic/live-lesson-platform-handlers \
  node packages/backend/dist/src/main.js
```

With the env unset, the platform boots truly generic — no handlers
load, no triggers register, dashboard endpoints don't exist.

## Cross-package import strategy

This package consumes platform types/services via the NPM `exports`
map declared on `@kedge-agentic/backend/package.json` (wildcard
`./*` → `./dist/src/*.js`). Two pieces make it work:

| Layer | Mechanism |
|---|---|
| TypeScript compile-time | `tsconfig.json` `paths: { "@kedge-agentic/backend/*": ["../../../../packages/backend/dist/src/*"] }` (handler typecheck requires backend `dist/src/*.d.ts` to exist; build backend first) |
| Jest test runtime | `package.json` `jest.moduleNameMapper: { "^@kedge-agentic/backend/(.*)$": "<rootDir>/../../../../packages/backend/dist/src/$1" }` |
| Node runtime | Resolves via the backend's `package.json` `exports` map automatically (Node 18+ honors the field) |

## Building + testing

```bash
cd /Users/niex/Documents/GitHub/kedge-ccaas

# 1. Build backend FIRST so dist/src/*.d.ts exists
npm run build:backend

# 2. Typecheck this package
cd solutions/business/live-lesson/platform-handlers && npx tsc --noEmit

# 3. Run the package's jest suite (~66 tests)
npx jest --no-coverage
```

## Adding a second solution

Mirror this package's layout under
`solutions/<biz-or-mock>/<slug>/platform-handlers/` with:

1. `package.json` — name `@kedge-agentic/<slug>-platform-handlers`,
   peerDependencies on `@kedge-agentic/backend` + ontology +
   observer-engine + nest + typeorm + zod.
2. `tsconfig.json` — copy this one's, no changes.
3. `src/index.ts` — export the aggregator module.
4. `src/<slug>-platform-handlers.module.ts` — `@Module({})`
   aggregating the solution's ontology registrar + workflow handlers
   + any solution-specific controllers.
5. Add the new path to root `package.json` `workspaces`.
6. Update deploy env to include the new package name in
   `PLATFORM_HANDLER_PACKAGES`.

That's it — `@kedge-agentic/backend` requires no changes.

## Why the package lives here, not under `packages/`

Conceptually correct: live-lesson is a solution; its platform-side
in-process handlers belong with the solution. The existing
`solutions/` directory already groups per-solution components
(`backend/`, `frontend/`, `creator/`, `creator-mcp-server/`, etc.).
`platform-handlers/` is just another sibling.

## Phase 5.5 decision log

- **Why dynamic `await import()` instead of declarative `imports: []`?**
  NestJS module imports are compile-time. To make
  `@kedge-agentic/backend` source genuinely solution-free, the deploy
  entrypoint must inject the handler list at boot. Env-driven dynamic
  import is the smallest hook.
- **Why a wildcard NPM `exports` map on backend?**
  The handler package imports many platform services
  (`WorkflowEngineService`, `IndicatorRegistryService`, etc.). An
  explicit per-subpath list would be 20+ entries; a wildcard `./*`
  is cleaner + lets future handler packages import any platform
  subpath without backend changes.
- **Why one aggregator module instead of one per concern?**
  Lower friction for `main.ts` (one import per package, one module
  class per package). Multiple modules can be split later.
- **Why default to "no handlers" on env unset?**
  Reinforces the architecture truth: `@kedge-agentic/backend` is
  solution-free. Backward-compatible defaults would obscure the
  boundary the phase 5.5 refactor explicitly creates.

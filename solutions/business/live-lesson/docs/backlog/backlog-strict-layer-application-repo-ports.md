# Backlog: Strict-Layer Phase 2b — Application Repository Ports

**Status**: ✅ Done (2026-05-24, commits `a8fe3309..71a7df95`)
**Created**: 2026-05-24
**Filed by**: Code review on `505e94e7` (post clean-arch refactor)
**Blocks**: nothing; honors the dependency rule already published in `CLAUDE.md`

> **Resolution.** All 9 entity migrations shipped across 9 commits (one per
> entity, smallest-blast-radius-first: ObservationRecord, DiscussTargetHit,
> DiscussHighlight, AiQuestion, ClassroomSession, Submission, ChatMessage,
> Student, Lesson). 1431 backend tests pass; `grep` returns zero hits for
> `from .*adapters/persistence/entities` inside non-test `application/`
> files. `ClassroomSnapshot` is intentionally left as `Repository<X>` since
> it is only used inside `adapters/transport/classroom-broadcast.service.ts`,
> which is the persistence-adjacent adapter layer.

## Context

The clean-architecture refactor (commits `3868fe67..505e94e7`) moved the backend into `domain/` / `application/` / `adapters/` / `infra/` layers and published the dependency rule in `CLAUDE.md`:

```
domain ← application ← adapters ← infra
```

Phase 1 (`8e13b645`) and Phase 2a (`17578145`) closed the **domain side**: domain no longer imports anything from `application/` or `adapters/` (verified — `grep` returns zero matches across non-test files). The `LlmPort` for `AiPromptBuilder` and 5 entity-shape interfaces in `domain/types/` are the seams.

Phase 2b is the **application side**: ~10 application services still inject TypeORM `Repository<X>` directly, which is technically an `adapters/persistence` type. Application can't import adapters per the strict rule, so each repo dependency needs a port abstraction.

This is **not blocking anything** today. Tests pass, app boots, behavior is identical. The gap is one of architectural rigor: the doc promises a rule the code half-honors.

## Why deferred

A first attempt during the code-review session (intermediate commits before the revert at `17578145`) showed the work is large and cascades through specs:

- ~10 entity repositories used across application: `Student`, `Submission`, `ClassroomSession`, `Lesson`, `ChatMessage`, `AiQuestion`, `DiscussHighlight`, `DiscussTargetHit`, `ClassroomSnapshot`, `ObservationRecord`
- ~70 application files inject one or more of these repos via `@InjectRepository(X) private readonly xRepo: Repository<X>`
- Each migrated service triggers spec-rewrite work (the bootstrap `Test.createTestingModule({ providers: [...] })` blocks need `{ provide: X_REPO_PORT, useValue: mock }` instead of `{ provide: getRepositoryToken(X), useValue: mock }`)
- Some specs construct deep-nest object literals (e.g. `classroom-state.service.spec.ts` has a 300+ line setup) — every mock needs surface change from `findOne/.find` to `findById/.findByIds` etc.

Total estimate: 6–8 hours of focused, mostly-mechanical work. The risk profile is **low for behavior** (signatures change, semantics don't) but **high for diff churn** (spec mocks ripple).

## Architecture

Per-entity, three new artifacts plus consumer migration:

```
domain/
├── types/<entity>.ts              # interface <Entity>Record (already done in Phase 2a for 5 entities)
└── ports/<entity>-repo.port.ts    # const <ENTITY>_REPO_PORT = Symbol(...); export interface <Entity>RepoPort

adapters/
└── persistence/
    └── repositories/
        └── <entity>.repository.ts # @Injectable class TypeOrm<Entity>Repository implements <Entity>RepoPort

infra/classroom.module.ts:
  TypeOrm<Entity>Repository,
  { provide: <ENTITY>_REPO_PORT, useExisting: TypeOrm<Entity>Repository },
```

Each port's method list is **driven by actual consumer usage**, not by the entity's surface. Audit each `Repository<X>.<method>` call site first to keep ports minimal — e.g. `LessonRepoPort` likely just needs `findById(id)` and `findByIds(ids)`, not `save`/`create`/`merge`/etc.

## Migration order — smallest blast radius first

1. **`Lesson` repo** — most callers, simplest API (read-only `findById` + `findByIds`). Touches ~10 application services. Includes the inline `this.studentRepo.manager.getRepository(Lesson)` pattern in 3 places (translate, ai-ask, personalization). `ManifestCacheService.getManifest()` signature changes to accept the port.

2. **`DiscussTargetHit` repo** — only `ClusterAggregator` uses it (now in `application/discussion/`). Needs `findBySession` + `upsertHit`.

3. **`Submission` repo** — used in `StudentSubmissionService`, `ClassroomStateService`, `PersonalizationService`. Heavy reads (per-session, per-student, per-step variants); make sure the port covers them all.

4. **`ChatMessage` repo** — used by `DiscussService`, `AiAskService`, `TranslateService`, `DiscussObserveHandler`. Reads (per-thread, per-step) + writes (append turn).

5. **`Student` repo** — `ClassroomService`, `StudentSubmissionService`. Mostly `findOne({where:...})` and `update`.

6. **`ClassroomSession` repo** — session lifecycle reads/writes; tightest coupling to `ClassroomService`.

7. **`AiQuestion` repo** — `AiAskService` writes turns; query side reads in observation handlers.

8. **`DiscussHighlight` repo** — `CoachingService` + `DepthRankingService`.

9. **`ClassroomSnapshot` repo** — `ClassroomBroadcastService` (adapter — actually fine where it is, but the read side is in application).

10. **`ObservationRecord` repo** — `ObservationQueryService`. Mostly aggregate query; will want a richer port (filter/sort options).

Order is intentional: each step ends with backend tests still green, so the work can be paused/resumed without leaving the tree broken.

## Caches to migrate at the end (Phase 3 in the original plan)

After repos are done, ports for `ManifestCacheService`, `StateCacheService`, and the `ClassroomBroadcastService` SSE channel. Smaller scope (only 3 surfaces), but same shape.

## Files to read first

- `solutions/business/live-lesson/backend/src/domain/ports/llm.port.ts` — the `LlmPort` reference impl shows the minimal-surface pattern + DI binding style
- `solutions/business/live-lesson/backend/src/domain/types/lesson.ts` (and siblings) — the `<Entity>Record` pattern (interface + `implements` on the TypeORM class)
- `solutions/business/live-lesson/backend/src/infra/classroom.module.ts` lines 30–40 + the `Domain port bindings` section — DI wiring template
- `solutions/business/live-lesson/backend/src/application/classroom/task-map-cache.ts` — the Phase 2a "impure helper moved out of domain" template; mirror this if any application/* file needs to also relocate

## Verification

After each per-entity step:

1. `cd solutions/business/live-lesson/backend && npx tsc --noEmit` clean
2. `cd solutions/business/live-lesson/backend && npx jest --no-coverage` — 1431 passing (number may grow if new tests added)
3. `grep -rln "Repository<<EntityJustMigrated>>" solutions/business/live-lesson/backend/src --include="*.ts" | grep -v ".spec.ts" | grep -v "adapters/persistence/repositories/"` returns only the adapter impl

After the full sweep:

```bash
grep -rn "from .*['\"][^'\"]*adapters/persistence" solutions/business/live-lesson/backend/src/application --include="*.ts" | grep -v ".spec.ts"
# Should return zero hits.
```

## Out of scope

- Migrating `LessonService` away from `Repository<Lesson>` for its seeding/save/create methods — that file lives in `application/lesson/` but its full row CRUD argues for either (a) extending the port with seed-time methods, or (b) moving the service into `adapters/persistence/` since it's effectively data-layer code. Decide as part of the work; don't force a choice up front.
- Project-side `Repository<Lesson>` usage in `src/project/` — that's a separate admin module, different scope.
- Touching the §14 L3 / Inspector path — playground-only, not the production grading path.

## Risks

| Risk | Mitigation |
|---|---|
| Per-entity port API gets bloated as new methods get tacked on | Audit consumer calls BEFORE writing the port. Each method must justify itself by an existing caller, not "we might need it later." |
| TestingModule bootstrap blocks in specs get out of sync | Do one entity at a time. After each, run `npx jest --no-coverage` so spec failures localize to the entity just touched. |
| Subtle behavior change between `repo.findOne({where})` and `port.findById(id)` (e.g. relations, soft-delete) | Audit the TypeORM call options when defining each port method. The default `findOne({where:{id}})` is straightforward; anything with `relations`, `withDeleted`, `select`, etc. is a flag to design the port more carefully. |
| Spec churn balloons the diff | Land per-entity commits (Lesson, then DiscussTargetHit, then Submission, etc.) — each one is reviewable on its own. Don't bundle all 10 into one PR. |

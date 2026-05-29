# ADR-0001: Core Backend Must Not Contain Domain-Specific Entities

**Status**: Accepted
**Date**: 2026-02-13
**Decision Maker**: @niex
**Related Issue**: Architecture violation discovered during code review

---

## Background (Context)

### The Violation

During a routine code review, we discovered that the core CCAAS backend contained a complete `lesson-plans` module (1,370 lines) with:
- TypeORM entity (`LessonPlanEntity`)
- Full CRUD service and REST API
- Complete test suite (799 lines)

This code duplicated functionality already present in the `solutions/lesson-plan-designer/backend`, creating architectural confusion and violating separation of concerns.

### Root Causes

**1. Historical Evolution**:
- The lesson-plans module was prototyped in the core backend for rapid iteration
- Later extracted to a solution backend following the solution pattern
- **Critical mistake**: Original code was never deleted from core, creating duplication

**2. Unclear Architecture Boundaries**:
- No explicit rule stating "Core = relay only, no domain entities"
- No automated enforcement mechanism (architecture tests, linting)
- Confusion about whether "core needs lesson plans for context sync" (it didn't)

**3. TypeORM Integration Temptation**:
```typescript
// TOO EASY to violate architecture:
TypeOrmModule.forRoot({
  entities: [Session, Skill, LessonPlan, ...],  // ← One line adds domain entity!
})
```

**4. Incremental Development Anti-Pattern**:
```
1. Build feature in core (fast) ✓
2. Extract to solution (good intent) ✓
3. Copy code to solution (creates duplication) ⚠️
4. Forget to delete from core (technical debt) ❌
```

### Impact

- **Code duplication**: 1,370 lines × 2 backends
- **Unclear responsibility**: Which backend should frontend call?
- **Data inconsistency risk**: Two separate databases
- **Core bloat**: Domain logic in a relay service
- **Solution coupling**: Core depends on specific solution's domain model

---

## Decision

**We decided**: Core CCAAS backend **MUST NOT** contain domain-specific entities or business logic.

### Architecture Principle (Mandatory)

> **Core CCAAS** = Agent relay + skill routing + authentication + generic infrastructure
>
> **Solution backends** = Domain data + business logic + integration + solution-specific APIs
>
> **Never mix the two**

### Detailed Rules

**Allowed in Core Backend** (Infrastructure):
- ✅ `Session` - Chat session management (relay)
- ✅ `Skill` - Skill registration and routing
- ✅ `User`, `ApiKey` - Authentication and authorization
- ✅ `Message` - Chat message history (relay)
- ✅ `File` - Generic file metadata (not domain-specific)
- ✅ `OutputUpdate` - Protocol event handling
- ✅ `ScheduledTask` - Generic task scheduling

**FORBIDDEN in Core Backend** (Domain Logic):
- ❌ `LessonPlan`, `Textbook`, `CurriculumStandard` (education domain)
- ❌ `Product`, `Order`, `Cart` (e-commerce domain)
- ❌ `Patient`, `Appointment`, `MedicalRecord` (healthcare domain)
- ❌ **Any solution-specific business entity**

### Why This Decision

1. **Single Responsibility**: Core should only relay AgentEngine communication, not manage domain data
2. **Solution Independence**: Each solution can choose its own database, ORM, and architecture
3. **Scalability**: Core stays lean and can support unlimited solution types
4. **Maintainability**: Clear boundaries prevent architectural drift
5. **Testability**: Domain logic tested in solution context, not mixed with relay logic

---

## Alternatives Considered

### Alternative A: Keep Domain Entities in Core

**Description**: Allow core backend to store domain entities for "convenience"

**Pros**:
- ✅ Faster initial development (no separate backend needed)
- ✅ Single database for small solutions

**Cons**:
- ❌ Core becomes bloated with unrelated domains
- ❌ All solutions share same database technology
- ❌ Tight coupling between core and solutions
- ❌ Cannot optimize storage per-solution
- ❌ Core must understand all domain models

**Why Not Chosen**: Violates single responsibility and limits solution independence

---

### Alternative B: Core Has No Entities at All ⭐ **Selected Approach**

**Description**: Core only manages infrastructure entities (Session, Skill, Auth). All domain logic lives in solution backends.

**Pros**:
- ✅ Clear architectural boundary
- ✅ Core stays lean and focused
- ✅ Solutions can use any database/ORM
- ✅ Independent deployment and scaling
- ✅ Easy to add new solution types

**Cons**:
- ❌ Requires solution backends (more infrastructure)
- ❌ Frontend must integrate with multiple backends

**Why Chosen**: Best long-term architecture for a multi-solution platform

---

### Alternative C: Shared Entity Library

**Description**: Put common entities in `@kedge-agentic/common` package

**Pros**:
- ✅ Code reuse across solutions

**Cons**:
- ❌ Creates coupling between solutions
- ❌ Not all solutions need same entities
- ❌ Schema evolution becomes difficult

**Why Not Chosen**: Solutions should be independent

---

## Consequences

### Positive Impacts

- ✅ **Architectural purity restored**: Core is truly general-purpose
- ✅ **No code duplication**: Single source of truth per entity
- ✅ **Solution independence**: Each solution owns its domain model
- ✅ **Core stays lean**: Easier to understand and maintain
- ✅ **Scalability**: Can support unlimited solution types
- ✅ **Zero breaking changes**: Frontend already used solution backend

### Negative Impacts

- ❌ **More infrastructure required**: Each solution needs its own backend
- ❌ **Frontend integration complexity**: Must connect to multiple backends
- ⚠️ **Initial learning curve**: Developers must understand two-backend architecture

### Needs Attention

- ⚠️ **Architecture tests required**: Prevent future violations
- ⚠️ **Developer documentation**: Clear guidelines on what goes where
- ⚠️ **Code review vigilance**: Watch for new `@Entity()` additions to core

---

## Implementation Guide

### How to Implement This Decision

**Checklist Before Adding Entity to Core**:
- [ ] Is this infrastructure (Session, Skill, Auth)? → OK for core
- [ ] Is this domain-specific (LessonPlan, Product)? → STOP, use solution backend
- [ ] Run architecture tests: `npm run test:architecture`
- [ ] Code review: Does this belong to a specific solution? → Solution backend

**Standard Solution Backend Structure**:
```
solutions/my-solution/
├── backend/                    # Solution owns its backend
│   ├── src/
│   │   ├── domain/            # Domain entities HERE
│   │   │   └── my-entity.entity.ts
│   │   ├── api/               # REST endpoints
│   │   │   └── my-entity.controller.ts
│   │   └── app.module.ts
│   └── package.json
└── frontend/
    └── src/hooks/
        └── useSolution.ts     # Integrates with solution backend
```

**Frontend Integration Pattern**:
```typescript
export function useMyFeatureSession() {
  // Core CCAAS: WebSocket for chat relay
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001'  // Core backend
  })

  // Solution backend: REST for domain data
  const domainData = useMyFeatureAPI({
    apiUrl: 'http://localhost:3002'     // Solution backend
  })

  return { connection, domainData }
}
```

### Prevention Mechanisms

**1. Automated Architecture Tests** (TODO):
```typescript
// packages/backend/test/architecture.test.ts
describe('Core Backend Architecture Rules', () => {
  it('should not contain domain-specific entities', () => {
    const entities = getTypeOrmEntities()
    const forbidden = ['LessonPlan', 'Textbook', 'Product', 'Order']

    forbidden.forEach(name => {
      expect(entities).not.toContainEntityNamed(name)
    })
  })

  it('should not have solution-specific controllers', () => {
    const controllers = getControllers()
    const forbidden = ['LessonPlansController', 'ProductsController']

    forbidden.forEach(name => {
      expect(controllers).not.toContainControllerNamed(name)
    })
  })
})
```

**2. Pre-commit Hook** (TODO):
- Detect new `@Entity()` decorators in core
- Require justification for infrastructure entities

**3. CI/CD Validation** (TODO):
- Run architecture tests in GitHub Actions
- Block PRs that violate architecture rules

**4. Code Review Checklist**:
- [ ] New entity added to core?
- [ ] Is it infrastructure or domain?
- [ ] If domain → Request move to solution backend
- [ ] If infrastructure → Verify necessity

---

## References

- Original implementation summary: `docs/internal/implementation-summaries/LESSON_PLANS_MODULE_REMOVAL_COMPLETE.md`
- Commit: 2575c6f (lesson-plans module removal)
- Related: `docs/PROJECT_MANAGEMENT_GUIDE.md` (documentation guidelines)
- Related: `CLAUDE.md` (architecture principles section)

## See also

- [`docs/architecture/package-layering.md`](../architecture/package-layering.md) — extends this ADR's lean-core principle to the broader workspace package set. Where ADR-0001 says "core backend must be infrastructure-only," the layering analysis says "foundation packages must be framework-free." Same spirit, different scope.
- [`docs/architecture/package-refactor-plan.md`](../architecture/package-refactor-plan.md) — concrete refactor moves that codify and apply the layering convention.

---

## Update History

- **2026-02-13**: Initial ADR created from architecture violation case study
- **2026-02-14**: Formalized as ADR-0001 during documentation cleanup
- **2026-05-29**: Added "See also" link to `docs/architecture/` analysis + refactor plan that extend this ADR's lean-core principle to the broader package layout.

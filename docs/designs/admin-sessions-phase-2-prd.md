# CCAAS Admin Sessions - Phase 2 Product Requirements Document

**Document Version**: 1.0
**Date**: 2026-02-17
**Status**: Draft
**Author**: Product Team
**Stakeholders**: Backend Team, Frontend Team, Platform Operations

---

## Executive Summary

### Business Context
CCAAS platform currently manages AgentEngine sessions in memory only, limiting session visibility to in-memory data and preventing historical analysis. As the platform scales, operators need persistent session tracking, pagination, and historical insights to:
- Monitor session health across tenant workspaces
- Analyze usage patterns and cost trends
- Troubleshoot session issues with historical context
- Support compliance and audit requirements

### Problem Statement
**Current State**: Session data exists only in SessionManagerService memory (Map<sessionId, SessionState>). When backend restarts, all session history is lost. Admin UI can only display currently active sessions with no pagination, making it difficult to manage large tenant workspaces.

**Desired State**: Persistent session database table with pagination support, enabling historical queries, performance analytics, and scalable admin UI.

### Success Metrics
| Metric | Current | Target (Phase 2) | Measurement |
|--------|---------|------------------|-------------|
| Session visibility | In-memory only | Full history | Database row count |
| Admin UI performance | Degrades at 50+ sessions | Stable at 1000+ sessions | Page load time <500ms |
| Historical data retention | 0 days | 90 days | Retention policy enforcement |
| Pagination response time | N/A | <200ms | API latency p95 |

### Investment
- **Development**: ~3-5 days (Backend 2 days, Frontend 1 day, Testing 1-2 days)
- **Infrastructure**: Minimal (SQLite → can scale to PostgreSQL)
- **Risk**: Low (non-breaking change, backward compatible)

---

## 1. Problem Definition

### 1.1 Is ✅
- **Persistent session table** in existing CCAAS database
- **Backend pagination API** for admin sessions endpoint
- **Dual-write strategy** (memory + database) for real-time consistency
- **Database indexes** for query performance (tenantId, status, lastActivity)
- **Data retention** policy (90 days by default, configurable)
- **Migration guide** for upgrading from Phase 1

### 1.2 Is Not ❌
- **Real-time WebSocket streaming** of all sessions (uses existing SkillsGateway)
- **Session replay** or detailed execution logs (separate feature)
- **Advanced analytics dashboards** (Phase 3 scope)
- **Multi-region database replication** (future infrastructure)
- **Session archival to object storage** (separate compliance feature)

### 1.3 Out of Scope
- Changing core session lifecycle management
- Modifying AgentEngine integration
- Replacing in-memory session state (dual-write preserves both)
- Breaking changes to existing session APIs

---

## 2. User Stories and Requirements

### 2.1 Primary User: Platform Administrator

**User Story 1: View Paginated Session List**
```
As a platform administrator
I want to view paginated list of all sessions across tenants
So that I can efficiently browse large numbers of sessions without UI freezing
```

**Acceptance Criteria**:
- ✅ Admin UI displays sessions in pages (default 50 per page)
- ✅ Pagination controls: Previous, Next, Page number selector
- ✅ Filter by: tenantId, status, date range
- ✅ Sort by: createdAt, lastActivity, messageCount
- ✅ Performance: <500ms page load for 1000+ sessions

**User Story 2: Query Historical Sessions**
```
As a platform administrator
I want to query sessions that ended days/weeks ago
So that I can troubleshoot issues and analyze usage patterns
```

**Acceptance Criteria**:
- ✅ Search sessions by date range (createdAt, closedAt)
- ✅ View closed sessions with final state (status, totalTokens, estimatedCost)
- ✅ Retention policy: 90 days default, configurable via environment variable
- ✅ Automatic cleanup of sessions older than retention period

**User Story 3: Monitor Tenant Activity**
```
As a platform administrator
I want to filter sessions by tenantId
So that I can monitor specific tenant workspace activity
```

**Acceptance Criteria**:
- ✅ Filter sessions by tenantId with fast query (<200ms)
- ✅ Show tenant-specific metrics: total sessions, active sessions, total cost
- ✅ Database index on (tenantId, createdAt) for performance

### 2.2 Secondary User: Developer

**User Story 4: Debug Session Issues**
```
As a developer
I want to query sessions by sessionId or status
So that I can debug issues in development/staging environments
```

**Acceptance Criteria**:
- ✅ API endpoint: `GET /api/v1/admin/sessions/:sessionId`
- ✅ API endpoint: `GET /api/v1/admin/sessions?status=error`
- ✅ Response includes: full session state, workspaceDir, error details

---

## 3. Technical Architecture

### 3.1 Database Schema

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId VARCHAR(255) UNIQUE NOT NULL,
  tenantId VARCHAR(255),
  clientId VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'idle',
    -- 'idle' | 'processing' | 'error' | 'closed'
  messageCount INTEGER DEFAULT 0,
  totalTokens INTEGER DEFAULT 0,
  estimatedCost REAL DEFAULT 0.0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastActivity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closedAt TIMESTAMP,
  workspaceDir VARCHAR(500),

  -- Indexes for query performance
  INDEX idx_sessions_tenant_created (tenantId, createdAt DESC),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_last_activity (lastActivity DESC),
  INDEX idx_sessions_session_id (sessionId)
);
```

**Design Decisions**:
- **UUID primary key**: Enables future sharding and distributed systems
- **sessionId UNIQUE**: Enforce one database row per session
- **Composite index (tenantId, createdAt)**: Optimizes tenant filtering and time-based queries
- **lastActivity index**: Enables "recently active" queries for monitoring

### 3.2 TypeORM Entity

```typescript
// packages/backend/src/admin/entities/session.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
@Index(['tenantId', 'createdAt'])
@Index(['status'])
@Index(['lastActivity'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  sessionId: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ nullable: true })
  clientId: string;

  @Column({ default: 'idle' })
  status: 'idle' | 'processing' | 'error' | 'closed';

  @Column({ default: 0 })
  messageCount: number;

  @Column({ default: 0 })
  totalTokens: number;

  @Column({ type: 'real', default: 0.0 })
  estimatedCost: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivity: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ nullable: true })
  workspaceDir: string;
}
```

### 3.3 API Changes

#### Current API (Phase 1)
```typescript
GET /api/v1/admin/sessions
Response: Session[] (all in-memory sessions, no pagination)
```

#### New API (Phase 2)
```typescript
GET /api/v1/admin/sessions?page=1&pageSize=50&tenantId=quiz-analyzer&status=idle
Response: {
  items: Session[],
  total: number,
  page: number,
  pageSize: number,
  totalPages: number
}
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Current page (1-indexed) |
| pageSize | number | 50 | Items per page (max: 250) |
| tenantId | string | null | Filter by tenant |
| status | string | null | Filter by status |
| startDate | ISO8601 | null | Filter createdAt >= startDate |
| endDate | ISO8601 | null | Filter createdAt <= endDate |
| sortBy | string | 'createdAt' | Sort field |
| sortOrder | 'ASC'\|'DESC' | 'DESC' | Sort direction |

**Error Responses**:
- `400 Bad Request`: Invalid pagination parameters (pageSize > 250, page < 1)
- `500 Internal Server Error`: Database query failure

### 3.4 Dual-Write Strategy

**Principle**: Maintain both in-memory state (for real-time operations) and database (for persistence and pagination).

```typescript
// SessionManagerService.createSession()
async createSession(sessionId: string, tenantId: string): Promise<Session> {
  // 1. Create in-memory state (Phase 1 logic - unchanged)
  const session = { sessionId, tenantId, status: 'idle', ... };
  this.sessions.set(sessionId, session);

  // 2. Write to database (Phase 2 addition)
  await this.sessionRepository.save({
    sessionId,
    tenantId,
    status: 'idle',
    createdAt: new Date(),
    lastActivity: new Date(),
  });

  return session;
}

// SessionManagerService.updateSessionState()
async updateSessionState(sessionId: string, updates: Partial<Session>): Promise<void> {
  // 1. Update in-memory state (Phase 1 logic - unchanged)
  const session = this.sessions.get(sessionId);
  Object.assign(session, updates);

  // 2. Update database (Phase 2 addition)
  await this.sessionRepository.update(
    { sessionId },
    { ...updates, lastActivity: new Date() }
  );
}

// SessionManagerService.closeSession()
async closeSession(sessionId: string): Promise<void> {
  // 1. Remove from memory (Phase 1 logic - unchanged)
  this.sessions.delete(sessionId);

  // 2. Update database status (Phase 2 addition)
  await this.sessionRepository.update(
    { sessionId },
    { status: 'closed', closedAt: new Date() }
  );
}
```

**Consistency Considerations**:
- **Write order**: Database write after memory update (optimistic, fast failure)
- **Read source**: Memory for real-time operations, database for admin queries
- **Failure handling**: Log database write failures, don't block session operations
- **Recovery**: Periodic reconciliation job (Phase 3) to sync memory ↔ database

### 3.5 Migration Path

**TypeORM Migration** (auto-generated, reviewed):
```typescript
// packages/backend/src/migrations/1708185600000-CreateSessionsTable.ts
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSessionsTable1708185600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'sessionId', type: 'varchar', isUnique: true },
          { name: 'tenantId', type: 'varchar', isNullable: true },
          { name: 'clientId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', default: "'idle'" },
          { name: 'messageCount', type: 'integer', default: 0 },
          { name: 'totalTokens', type: 'integer', default: 0 },
          { name: 'estimatedCost', type: 'real', default: 0.0 },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'lastActivity', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'closedAt', type: 'timestamp', isNullable: true },
          { name: 'workspaceDir', type: 'varchar', isNullable: true },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({ name: 'idx_sessions_tenant_created', columnNames: ['tenantId', 'createdAt'] })
    );
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({ name: 'idx_sessions_status', columnNames: ['status'] })
    );
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({ name: 'idx_sessions_last_activity', columnNames: ['lastActivity'] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions');
  }
}
```

**Backward Compatibility**:
- ✅ Existing in-memory sessions continue to work
- ✅ Admin UI gracefully falls back to in-memory if database query fails
- ✅ No breaking changes to session lifecycle APIs

---

## 4. Frontend Changes

### 4.1 Admin UI Updates

**Before (Phase 1)**:
```tsx
// Loads all sessions, no pagination
const { data: sessions } = useSessions();

return (
  <div>
    {sessions.map(session => <SessionRow key={session.sessionId} {...session} />)}
  </div>
);
```

**After (Phase 2)**:
```tsx
// Paginated with filters
const [page, setPage] = useState(1);
const [filters, setFilters] = useState({ tenantId: null, status: null });

const { data, isLoading } = usePaginatedSessions({ page, pageSize: 50, ...filters });

return (
  <div>
    <SessionFilters onChange={setFilters} />
    <SessionTable sessions={data.items} />
    <Pagination
      current={data.page}
      total={data.totalPages}
      onChange={setPage}
    />
  </div>
);
```

### 4.2 React Hook

```typescript
// packages/admin-next/src/hooks/usePaginatedSessions.ts
interface UsePaginatedSessionsParams {
  page: number;
  pageSize: number;
  tenantId?: string;
  status?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function usePaginatedSessions(params: UsePaginatedSessionsParams) {
  return useQuery({
    queryKey: ['sessions', 'paginated', params],
    queryFn: async () => {
      const query = new URLSearchParams({
        page: params.page.toString(),
        pageSize: params.pageSize.toString(),
        ...(params.tenantId && { tenantId: params.tenantId }),
        ...(params.status && { status: params.status }),
      });

      const response = await fetch(`/api/v1/admin/sessions?${query}`);
      if (!response.ok) throw new Error('Failed to fetch sessions');

      return response.json() as Promise<PaginatedResponse<Session>>;
    },
    keepPreviousData: true, // Smooth pagination transitions
    staleTime: 10000, // Cache for 10 seconds
  });
}
```

---

## 5. Data Retention Policy

### 5.1 Automatic Cleanup

**Scheduled Task** (runs daily at 2 AM):
```typescript
// packages/backend/src/admin/tasks/session-cleanup.task.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SessionEntity } from '../entities/session.entity';

@Injectable()
export class SessionCleanupTask {
  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepository: Repository<SessionEntity>
  ) {}

  @Cron('0 2 * * *') // Daily at 2 AM
  async cleanupOldSessions() {
    const retentionDays = parseInt(process.env.SESSION_RETENTION_DAYS || '90', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.sessionRepository.delete({
      createdAt: LessThan(cutoffDate),
      status: 'closed', // Only delete closed sessions
    });

    console.log(`[SessionCleanup] Deleted ${result.affected} sessions older than ${retentionDays} days`);
  }
}
```

**Configuration**:
```bash
# .env
SESSION_RETENTION_DAYS=90  # Default: 90 days
```

### 5.2 Manual Cleanup (Admin API)

```typescript
POST /api/v1/admin/sessions/cleanup
Request Body: {
  "olderThanDays": 90,
  "status": "closed" // Optional: only cleanup closed sessions
}
Response: {
  "deletedCount": 1234,
  "message": "Successfully deleted 1234 sessions older than 90 days"
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**SessionEntity** (TypeORM entity):
- ✅ Validates field types and constraints
- ✅ Tests index definitions
- ✅ Verifies default values

**SessionRepository** (database operations):
- ✅ Create session record
- ✅ Update session with pagination params
- ✅ Query with filters (tenantId, status, date range)
- ✅ Delete old sessions (retention policy)

**SessionManagerService** (dual-write logic):
- ✅ Creates session in both memory and database
- ✅ Updates session state in both locations
- ✅ Closes session (removes from memory, updates database)
- ✅ Handles database write failures gracefully

### 6.2 Integration Tests

**Admin Sessions API**:
```typescript
describe('GET /api/v1/admin/sessions (pagination)', () => {
  it('should return paginated sessions with default params', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/sessions')
      .expect(200);

    expect(response.body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      pageSize: 50,
      totalPages: expect.any(Number),
    });
  });

  it('should filter sessions by tenantId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/sessions?tenantId=quiz-analyzer')
      .expect(200);

    expect(response.body.items.every(s => s.tenantId === 'quiz-analyzer')).toBe(true);
  });

  it('should validate pageSize max limit', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/sessions?pageSize=300')
      .expect(400);
  });
});
```

**Database Query Performance**:
```typescript
describe('Session query performance', () => {
  beforeAll(async () => {
    // Seed 1000 sessions
    await seedSessions(1000);
  });

  it('should query 50 sessions in <200ms', async () => {
    const start = Date.now();
    await sessionRepository.find({
      take: 50,
      order: { createdAt: 'DESC' },
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
```

### 6.3 E2E Tests

**Admin UI Pagination**:
```typescript
describe('Admin Sessions Page', () => {
  it('should load paginated sessions on mount', async () => {
    await page.goto('/admin/sessions');
    await page.waitForSelector('[data-testid="session-table"]');

    const rows = await page.$$('[data-testid="session-row"]');
    expect(rows.length).toBeLessThanOrEqual(50);
  });

  it('should navigate to next page', async () => {
    await page.click('[data-testid="pagination-next"]');
    await page.waitForSelector('[data-testid="session-table"]');

    const urlParams = new URL(page.url()).searchParams;
    expect(urlParams.get('page')).toBe('2');
  });
});
```

---

## 7. Performance Considerations

### 7.1 Query Optimization

**Index Usage**:
```sql
-- Query: Get tenant sessions, most recent first
EXPLAIN SELECT * FROM sessions
WHERE tenantId = 'quiz-analyzer'
ORDER BY createdAt DESC
LIMIT 50;

-- Should use: idx_sessions_tenant_created (composite index)
```

**Pagination Performance**:
| Sessions in DB | Query Time (p95) | Notes |
|----------------|------------------|-------|
| 100 | <50ms | Fast, direct index lookup |
| 1,000 | <100ms | Still fast |
| 10,000 | <200ms | Target performance |
| 100,000 | <500ms | May need query optimization |

**Optimization Strategies**:
1. **Composite indexes**: (tenantId, createdAt) for common queries
2. **Cursor-based pagination** (Phase 3): For very large datasets
3. **Caching**: Frontend cache (React Query 10s staleTime)
4. **Database scaling**: Migrate to PostgreSQL if SQLite becomes bottleneck

### 7.2 Memory Impact

**Before (Phase 1)**:
- Memory usage: ~10MB per 1000 sessions (in-memory only)

**After (Phase 2)**:
- Memory usage: Same (dual-write doesn't increase in-memory storage)
- Disk usage: ~100KB per 1000 sessions (SQLite)

**Recommendation**: No memory concerns for Phase 2. Disk usage minimal.

---

## 8. Migration and Rollout Plan

### 8.1 Phase Rollout

**Week 1: Backend Implementation**
- Day 1-2: TypeORM entity, migration, repository setup
- Day 3: Dual-write integration in SessionManagerService
- Day 4: Pagination API endpoints and DTOs
- Day 5: Unit + integration tests

**Week 2: Frontend Implementation**
- Day 1: React hook (usePaginatedSessions)
- Day 2: Admin UI components (filters, pagination controls)
- Day 3: E2E tests
- Day 4: Performance testing and optimization
- Day 5: Documentation and code review

**Week 3: Deployment**
- Day 1: Deploy to staging
- Day 2-3: Manual testing and bug fixes
- Day 4: Deploy to production
- Day 5: Monitor and validate

### 8.2 Migration Steps

**Step 1: Run Migration**
```bash
cd packages/backend
npm run migration:run
```

**Step 2: Verify Schema**
```bash
sqlite3 .agent-workspace/data.db ".schema sessions"
```

**Step 3: Restart Backend**
```bash
npm run start:dev
```

**Step 4: Verify Dual-Write**
```bash
# Create a test session
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-tenant"}'

# Verify in database
sqlite3 .agent-workspace/data.db "SELECT * FROM sessions WHERE tenantId='test-tenant';"
```

**Step 5: Deploy Frontend**
```bash
cd packages/admin-next
npm run build
# Deploy to production
```

### 8.3 Rollback Plan

If Phase 2 causes issues:

1. **Disable database writes** (feature flag):
   ```typescript
   // Environment variable: ENABLE_SESSION_PERSISTENCE=false
   if (process.env.ENABLE_SESSION_PERSISTENCE !== 'false') {
     await this.sessionRepository.save(session);
   }
   ```

2. **Revert migration**:
   ```bash
   npm run migration:revert
   ```

3. **Deploy previous frontend version**

---

## 9. Risks and Mitigation

### 9.1 Risk Matrix

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database write failures break session creation | High | Low | Graceful failure: Log error, continue with memory-only |
| Performance degrades with large datasets | Medium | Medium | Index optimization, caching, cursor pagination (Phase 3) |
| Migration fails in production | High | Low | Test in staging, have rollback script ready |
| Data inconsistency (memory ≠ database) | Medium | Low | Reconciliation job (Phase 3), monitoring alerts |

### 9.2 Failure Handling

**Database Write Failure**:
```typescript
try {
  await this.sessionRepository.save(session);
} catch (error) {
  this.logger.error(`Failed to persist session ${sessionId}: ${error.message}`);
  // Continue execution - session still works in-memory
  // Alert monitoring system
  this.metricsService.incrementCounter('session_persistence_failures');
}
```

**Database Query Failure** (Admin UI):
```typescript
const { data, error } = usePaginatedSessions({ page: 1, pageSize: 50 });

if (error) {
  // Fallback: Show in-memory sessions without pagination
  const fallbackSessions = await fetch('/api/v1/admin/sessions/in-memory');
  return <SessionTable sessions={fallbackSessions} warning="Database unavailable, showing in-memory sessions only" />;
}
```

---

## 10. Success Criteria and Validation

### 10.1 Acceptance Criteria

**Functional Requirements**:
- ✅ Database table `sessions` created with correct schema
- ✅ Pagination API returns correct page/total/totalPages
- ✅ Filter by tenantId, status works correctly
- ✅ Sort by createdAt, lastActivity works correctly
- ✅ Admin UI displays paginated sessions
- ✅ Pagination controls work (prev/next/jump to page)
- ✅ Data retention cleanup runs successfully

**Non-Functional Requirements**:
- ✅ Query performance: <200ms p95 for 10,000 sessions
- ✅ Page load time: <500ms for admin sessions page
- ✅ No breaking changes to existing APIs
- ✅ Graceful failure: System continues if database unavailable
- ✅ Test coverage: ≥80% for new code

### 10.2 Validation Checklist

**Backend**:
- [ ] Migration runs successfully
- [ ] Session creation writes to both memory and database
- [ ] Session updates sync to database
- [ ] Session closure updates database status
- [ ] Pagination query returns correct results
- [ ] Filters (tenantId, status) work correctly
- [ ] Database indexes used in queries (verify with EXPLAIN)
- [ ] Data retention cleanup task runs daily

**Frontend**:
- [ ] Admin UI loads paginated sessions on mount
- [ ] Pagination controls navigate correctly
- [ ] Filters update query parameters
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Performance: <500ms page load

**Integration**:
- [ ] Create session → Verify in database
- [ ] Update session → Verify lastActivity updated
- [ ] Close session → Verify closedAt set
- [ ] Query 1000+ sessions → Performance acceptable
- [ ] Database failure → System continues in-memory

---

## 11. Documentation Updates

### 11.1 Files to Update

**Backend Documentation**:
- `packages/backend/CLAUDE.md` - Add Phase 2 features to Admin Module section
- `packages/backend/docs/ADMIN_API.md` - Document pagination parameters
- `packages/backend/README.md` - Update feature list

**Admin UI Documentation**:
- `packages/admin-next/README.md` - Document pagination hooks
- `packages/admin-next/docs/COMPONENTS.md` - Add SessionTable, Pagination docs

**Migration Guide**:
- Create `docs/migrations/ADMIN_SESSIONS_PHASE_2.md` with migration steps

### 11.2 API Documentation

Add to `packages/backend/docs/API.md`:

```markdown
## Admin Sessions API

### GET /api/v1/admin/sessions

List sessions with pagination and filtering.

**Query Parameters**:
- `page` (number, default: 1): Current page
- `pageSize` (number, default: 50, max: 250): Items per page
- `tenantId` (string): Filter by tenant
- `status` (string): Filter by status ('idle' | 'processing' | 'error' | 'closed')
- `startDate` (ISO8601): Filter createdAt >= startDate
- `endDate` (ISO8601): Filter createdAt <= endDate

**Response**:
```json
{
  "items": [
    {
      "sessionId": "abc123",
      "tenantId": "quiz-analyzer",
      "status": "idle",
      "messageCount": 5,
      "totalTokens": 1234,
      "estimatedCost": 0.02,
      "createdAt": "2026-02-17T10:00:00Z",
      "lastActivity": "2026-02-17T10:05:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 50,
  "totalPages": 2
}
```
```

---

## 12. Future Enhancements (Phase 3+)

### 12.1 Advanced Analytics
- **Session duration distribution**: Histogram of session lifetimes
- **Token usage trends**: Time-series chart of token consumption
- **Cost analysis by tenant**: Compare tenant spending
- **Error rate monitoring**: Track session failures

### 12.2 Performance Optimization
- **Cursor-based pagination**: For very large datasets (>100k sessions)
- **Database sharding**: Partition by tenantId for horizontal scaling
- **Caching layer**: Redis cache for frequently accessed sessions

### 12.3 Compliance and Audit
- **Session archival**: Export closed sessions to S3/object storage
- **Audit log**: Track all session state changes with timestamps
- **GDPR compliance**: Anonymize or delete sessions on user request

---

## Appendix A: Database Indexes Rationale

### Why Composite Index (tenantId, createdAt)?

**Query Pattern**:
```sql
-- Most common admin query: Recent sessions for a tenant
SELECT * FROM sessions
WHERE tenantId = 'quiz-analyzer'
ORDER BY createdAt DESC
LIMIT 50;
```

**Index Selection**:
1. **Separate indexes**: `(tenantId)` + `(createdAt)` → Requires index merge, slower
2. **Composite index**: `(tenantId, createdAt)` → Single index lookup, fast ✅

**Performance Impact**:
- Without index: Full table scan (O(n))
- With composite index: O(log n) for tenant filter + O(1) for sorted range

---

## Appendix B: TypeORM vs Raw SQL

**Why TypeORM for Phase 2?**

**Pros**:
- ✅ Type safety (TypeScript entities)
- ✅ Database agnostic (SQLite → PostgreSQL migration easier)
- ✅ Automatic migrations
- ✅ Consistent with existing CCAAS codebase

**Cons**:
- ❌ Query builder overhead (minor for pagination use case)
- ❌ Complex queries may need raw SQL

**Decision**: Use TypeORM for Phase 2, optimize with raw SQL if performance issues arise in Phase 3.

---

## Appendix C: Alternative Approaches Considered

### Option 1: Full Migration to Database-Only (No Memory)
**Rejected**: Breaking change, requires rewriting SessionManagerService core logic. High risk.

### Option 2: Event Sourcing (Append-only Log)
**Rejected**: Over-engineering for current scale. Adds complexity without clear ROI.

### Option 3: Separate Analytics Database
**Rejected**: Premature optimization. Single database sufficient for Phase 2 scale.

### Option 4: Offset-Based Pagination (Current Choice)
**Selected**: Simple, standard, sufficient for expected dataset size (10k-100k sessions).

### Option 5: Cursor-Based Pagination
**Deferred to Phase 3**: More complex, better for very large datasets. Implement if performance issues arise.

---

**Document Status**: Ready for Review
**Next Steps**: Technical review → Development → Testing → Deployment

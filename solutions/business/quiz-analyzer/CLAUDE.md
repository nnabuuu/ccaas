# CLAUDE.md - Quiz Analyzer Solution

## Overview

AI-powered quiz analysis system: knowledge point tagging, solution thought process generation, wrong answer analysis, and batch processing. Built on CCAAS platform with MCP REST server + NestJS backend + React frontend.

## Quick Links

- [README.md](./README.md) - User docs & development workflow
- [SOLUTION_DESIGN.md](./SOLUTION_DESIGN.md) - Architecture & design decisions
- [backend/README.md](./backend/README.md) - Database schema, migrations, entities
- [mcp-server/README.md](./mcp-server/README.md) - REST API endpoints & MCP tools
- [scripts/](./scripts/) - Excel import & database setup

## Critical Rules

### TDD Mandatory (Lesson from lesson-plan-designer)

**Before modifying code**:
- [ ] Run `npm test` to confirm all tests pass
- [ ] If changing API/interface, check frontend types and existing tests
- [ ] Review `@kedge-agentic/common` types for contract definitions

**After modifying code**:
- [ ] Immediately run related tests
- [ ] Test failure = stop and analyze, don't continue

> Tests are the code contract, plans are just intention expressions.
> When plans conflict with tests, question the plan, not the tests.

### SYNC_FIELDS Three-Layer Sync

10 synchronized fields defined in `mcp-server/src/types.ts`, validated by Zod schemas in `mcp-server/src/schemas.ts`. Fields: quizAnalysis, knowledgePointTags, thinkingProcess, solutionSteps, correctAnswer, commonMistakes, knowledgeGapAnalysis, difficulty, relatedQuizzes, timeEstimate.

When adding a new SYNC_FIELD, update all three layers:
1. `mcp-server/src/types.ts` - Add to SYNC_FIELDS array + TypeScript interface
2. `mcp-server/src/schemas.ts` - Add Zod schema
3. `solution.json` - Add to syncFields array

### Database Migrations

**Always inspect actual schema before writing migrations** — code/docs can drift from DB reality:
```bash
sqlite3 data/quiz-analyzer.db ".schema TABLE_NAME"
sqlite3 data/quiz-analyzer.db "PRAGMA table_info(TABLE_NAME)"
```

## Common Tasks

### Add a New MCP Tool
1. Add endpoint in `mcp-server/src/index.ts`
2. Define types in `types.ts`, add to `solution.json` allowedTools
3. Rebuild: `npm run build`

### Modify Database Schema
1. Update `scripts/schema.sql`
2. Delete & reimport: `node scripts/import-excel-to-db.js`
3. Update TypeORM entities + migration files

### Debug Import Issues
```bash
cd scripts && node analyze-excel-structure.js
sqlite3 ../data/quiz-analyzer.db "SELECT COUNT(*) FROM knowledge_points"
```

## Integration with CCAAS

MCP server registered in `solution.json` as `quiz-analyzer-tools` (port 3006, `rest-adapter` type). Skill triggered by keywords: `分析这道题`, `解题思路`, `知识点`, `批量分析`.

## Key Implementation Notes

### Conversation Persistence

Server-side persistence via 3 tables (messages, conversation_contexts, turns). Backend services: MessagesService, ConversationContextService, TurnsService. REST endpoints under `/api/v1/sessions/:sessionId/`. Frontend `useQuizSession` hook manages history loading and session lifecycle. Migration: `scripts/migrations/003-conversation-persistence.sql`.

### Type Safety

All shared types from `@kedge-agentic/common`. SYNC_FIELDS validated at runtime with Zod via `validateAndFixField()`.

### Error Handling

- Excel import: missing columns use fallback values, invalid parents skip with warning
- MCP tools: 400 for invalid fields/validation, 500 for DB errors (sanitized)
- Batch processing: individual failures don't break batch, cancellation supported

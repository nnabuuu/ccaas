# CLAUDE.md - Problem Explainer Solution

## Overview

讲题助手: AI-driven end-to-end problem explanation workflow — analyze problems, generate lecture scripts, audio (NotebookLM), and PPT. Built on CCAAS platform with MCP REST server (port 3004) + NestJS backend (port 3003) + React frontend (port 5281).

## Quick Links

- [README.md](./README.md) - User docs, architecture, & development workflow
- [solution.json](./solution.json) - Skill config, triggers, MCP server registration
- Backend: `backend/` (NestJS + TypeORM + SQLite, port 3003)
- MCP Server: `mcp-server/` (Express.js REST API, port 3004)
- Frontend: `frontend/` (React + Vite + Tailwind, port 5281)

## Startup

```bash
./setup.sh                    # Start all services
./setup.sh --mcp-only         # MCP server only
./setup.sh --inject-only      # Inject skills & MCP config to CCAAS

# Or individually:
cd mcp-server && npm run start   # port 3004
cd backend && npm run start:dev  # port 3003
cd frontend && npm run dev       # port 5281
```

**Prerequisite**: CCAAS backend running on port 3001.

## Critical Rules

### TDD Mandatory

**Before modifying code**:
- [ ] Run `npm test` to confirm all tests pass
- [ ] Check `frontend/src/types/index.ts` and `mcp-server/src/types.ts`

**After modifying code**:
- [ ] Immediately run related tests
- [ ] Test failure = stop and analyze

### SYNC_FIELDS

8 synchronized fields defined in `mcp-server/src/types.ts`: problemAnalysis, keyKnowledge, solutionSteps, answer, commonMistakes, relatedProblems, hints, difficulty.

### Workflow Phases

| Phase | Action | Related Skill |
|-------|--------|---------------|
| 1 | 分析题目 (知识点、步骤、难度) | — |
| 2 | 生成讲稿 (generate_script_template) | — |
| 3 | 生成音频 | /notebooklm |
| 4 | 生成 PPT | /pptx |
| 5 | 输出文件 (.md, .mp3, .pptx) | — |

User commands: `讲解这道题` (Phase 1), `生成讲稿` (1+2), `生成音频` (1-3), `生成PPT` (1-2+4), `全套材料` (1-5).

## MCP REST API (port 3004)

CCAAS calls via `rest-adapter` type. Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/tools/write_output` | Sync content to frontend |
| `/tools/get_subjects` | Get subject list |
| `/tools/get_knowledge_points` | Query knowledge points |
| `/tools/calculate_difficulty` | Calculate difficulty (formula: `min(5, ceil(kpCount*0.5 + stepCount*0.3))`) |
| `/tools/generate_script_template` | Generate lecture script template |

## File Output

Generated files saved to `.agent-workspace/sessions/{sessionId}/outputs/` (讲稿.md, 音频.mp3, PPT.pptx). Downloadable via message attachments.

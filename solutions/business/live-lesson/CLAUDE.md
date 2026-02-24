# Live Lesson - AI Interactive Teaching System

## Overview
AI-driven interactive teaching system with dynamic blackboard and Socratic dialogue.

**No solution backend** - all state managed in MCP server memory.

## Architecture
- **MCP Server**: In-memory state machine, 6 board control tools
- **Frontend**: React + Vite (port 5283), boardState from output_update events
- **Skill**: socratic-teacher - behavior guide for AI teacher

## Key Files
- `data/lessons/math-linear-eq-intro/manifest.json` - Lesson data (13 nodes, 5 phases, 3 confusion points)
- `mcp-server/src/state-manager.ts` - Singleton board state machine
- `mcp-server/src/index.ts` - 6 MCP tools
- `frontend/src/hooks/useLiveLesson.ts` - boardState accumulation hook
- `skills/socratic-teacher/SKILL.md` - AI teacher behavior guide

## Dev Commands
```bash
# MCP server
cd mcp-server && npm install && npm run build

# Frontend
cd frontend && npm install && npm run dev
```

## Ports
- Frontend: 5283
- CCAAS Backend: 3001 (required)

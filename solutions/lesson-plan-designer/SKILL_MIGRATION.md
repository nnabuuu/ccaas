# Skill Migration Guide

## What Changed

- **NotebookLM skill moved** from `~/.claude/skills/notebooklm` (global) to `solutions/lesson-plan-designer/skills/notebooklm` (local)
- **Solution is now self-contained** - all skill dependencies are tracked in the solution directory
- **No dependency on global configuration** - does not rely on `~/.claude/settings.json` plugins
- **Clean skill environment** - sessions only load skills explicitly defined in the solution

## Why This Change?

### Previous Problem

```
Claude Code Session启动:
1. 读取 ~/.claude/settings.json → 加载 example-skills (含pdf/pptx)
2. 读取 ~/.claude/skills/notebooklm → 加载全局技能
3. 读取 workspace/.claude/skills/ → 加载workspace技能

问题：
❌ 全局插件污染workspace环境
❌ NotebookLM依赖全局安装
❌ Solution不可独立部署
❌ 技能冲突无法控制
```

### New Architecture

```
Solution自包含架构:
1. Backend: 创建session时设置 enabledPlugins: {} (禁用全局插件)
2. Solution: skills/notebooklm/ (自包含技能)
3. Setup: inject-skills.sh 导入到CCAAS数据库
4. Session: 只加载CCAAS同步的技能

优势：
✅ Solution独立部署
✅ 技能依赖明确
✅ 无全局污染
✅ 环境可复现
```

## Setup Requirements

### 1. Install Solution

```bash
cd solutions/lesson-plan-designer
./setup.sh
```

This will:
- Install npm dependencies for backend, frontend, and MCP server
- Build the MCP server
- Inject skills into CCAAS database (if CCAAS is running)

### 2. Start CCAAS Backend

The solution requires CCAAS backend to be running:

```bash
cd packages/backend
npm run start:dev
```

CCAAS should be available at http://localhost:3001

### 3. Inject Skills

If CCAAS was not running during setup, manually inject skills:

```bash
cd solutions/lesson-plan-designer
./inject-skills.sh
```

## Verification

### Check Skills Loaded in CCAAS

```bash
curl -s -H "X-Tenant-Id: lesson-plan-designer" \
     http://localhost:3001/api/v1/skills | \
     jq '.items[] | {slug: .slug, enabled: .enabled, published: .published}'
```

Expected output:

```json
{
  "slug": "lesson-plan-designer",
  "enabled": true,
  "published": true
}
{
  "slug": "teaching-script-generator",
  "enabled": true,
  "published": true
}
{
  "slug": "notebooklm",
  "enabled": true,
  "published": true
}
```

### Check Session Skills Directory

After starting a session, verify that only solution skills are loaded:

```bash
# Start solution backend and create a session
cd solutions/lesson-plan-designer/backend
npm run start:dev

# Check workspace skills (after sending a message to create a session)
ls .agent-workspace/sessions/*/. claude/skills/
```

Expected directories:
- ✅ `lesson-plan-designer/`
- ✅ `teaching-script-generator/`
- ✅ `notebooklm/`

Should NOT contain:
- ❌ `example-skills:pdf`
- ❌ `example-skills:pptx`
- ❌ Any other global skills

### Test Skill Triggering

Test that NotebookLM triggers correctly without conflicts:

```bash
# Send a test message that previously triggered the wrong skill
curl -X POST http://localhost:3002/api/sessions/test-session/completion \
  -H "Content-Type: application/json" \
  -d '{"message": "用notebooklm生成一个测试音频"}'
```

Expected behavior:
- ✅ NotebookLM skill is activated
- ❌ No `example-skills:pdf` or `example-skills:pptx` triggers

## Clean Global Install (Optional)

If you no longer need the global NotebookLM skill, you can remove it:

### Remove Global Skill Directory

```bash
# Backup first (optional)
mv ~/.claude/skills/notebooklm ~/.claude/skills/notebooklm.backup

# Or delete directly
rm -rf ~/.claude/skills/notebooklm
```

### Disable Global Plugins

Edit `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "example-skills@anthropic-agent-skills": false
  }
}
```

This prevents `example-skills:pdf` and `example-skills:pptx` from loading globally.

## Benefits of This Architecture

### ✅ Self-Contained Solution
All dependencies (skills, MCP servers, data files) are in the solution directory. No hidden global dependencies.

### ✅ No Global Pollution
Each solution has a clean environment. No unexpected global skills interfering with solution-specific skills.

### ✅ Reproducible
Easy to deploy on different machines. Just clone the repo and run `./setup.sh`.

### ✅ Conflict-Free
No name collisions or trigger conflicts with global skills. Solution explicitly defines what skills it uses.

### ✅ Version Control
Skills are tracked in git. Easy to see what changed and when.

### ✅ Clear Dependencies
`solution.json` declares all related skills. No guessing what skills are needed.

## Troubleshooting

### Skills Not Loading

**Problem:** Session workspace doesn't contain solution skills

**Solution:**
1. Check CCAAS is running: `curl http://localhost:3001/api/v1/health`
2. Re-inject skills: `cd solutions/lesson-plan-designer && ./inject-skills.sh`
3. Restart solution backend: `cd backend && npm run start:dev`

### Wrong Skills Loading

**Problem:** Global skills (like `example-skills:pdf`) still appearing

**Solution:**
1. Check session service disables plugins: `packages/backend/src/chat/session.service.ts` should set `enabledPlugins: {}`
2. Disable global plugins in `~/.claude/settings.json`
3. Restart CCAAS backend

### NotebookLM Not Found

**Problem:** NotebookLM skill not available

**Solution:**
1. Verify skill exists: `ls solutions/lesson-plan-designer/skills/notebooklm/SKILL.md`
2. Check CCAAS database: `curl -H "X-Tenant-Id: lesson-plan-designer" http://localhost:3001/api/v1/skills/notebooklm`
3. Re-inject: `./inject-skills.sh`

## Migration Summary

| Aspect | Before | After |
|--------|--------|-------|
| **NotebookLM Location** | `~/.claude/skills/notebooklm` | `solutions/lesson-plan-designer/skills/notebooklm` |
| **Global Plugins** | Enabled by default | Disabled (`enabledPlugins: {}`) |
| **Skill Discovery** | Global + Workspace | CCAAS database only |
| **Deployment** | Requires global setup | Self-contained |
| **Conflicts** | Possible | Prevented |

## Files Modified

### New Files Added
1. `solutions/lesson-plan-designer/skills/notebooklm/SKILL.md` - Copied from global directory

### No Changes Needed (Already Good)
1. `inject-skills.sh` - Already auto-discovers `skills/*/SKILL.md`
2. `solution.json` - Already references `notebooklm` via slug
3. `setup.sh` - Already calls `inject-skills.sh`

### Previously Modified (Earlier Work)
1. `packages/backend/src/chat/session.service.ts` - Sets `enabledPlugins: {}` to disable global plugins
2. `solutions/lesson-plan-designer/frontend/src/App.tsx` - Removed hardcoded `EXCLUDED_SKILLS` filter

## Next Steps

After this migration, the solution is fully self-contained. To deploy on a new machine:

1. Clone the repository
2. Run `npm install` in the workspace root
3. Start CCAAS backend: `cd packages/backend && npm run start:dev`
4. Run solution setup: `cd solutions/lesson-plan-designer && ./setup.sh`
5. Start solution backend: `cd backend && npm run start:dev`
6. Start solution frontend: `cd frontend && npm run dev`

No global `~/.claude/settings.json` or `~/.claude/skills/` setup required!

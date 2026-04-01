# Spec: Geometry Figure Engine 优化

## Context

quiz-analyzer 的几何配图引擎有两层问题：
1. **渲染层 (GeometryFigure.tsx)** — 4 个已知 bug
2. **生成层 (geometry skill prompts)** — LLM 生成的 JXG JSON 质量不稳定

## Artifacts

### Track A — 渲染层 Bug 修复 (Phase 0, one-time)

| Bug | File | Symptom |
|-----|------|---------|
| evalExpr bare Math functions | `GeometryFigure.tsx:22-29` | `sin(x)` 不加 `Math.` 前缀时 ReferenceError |
| resolveParent missing ID | `GeometryFigure.tsx:43-47` | parent 引用不存在的 ID 时返回字符串而非 skip |
| expandElement parent count | `GeometryFigure.tsx:317-368` | incenter/circumcenter 等 parents 数量 ≠ 3 时解构崩溃 |
| animation range[0] >= range[1] | `GeometryFigure.tsx:129` + `schemas.ts:97` | range 反转时 slider 不动、step 为负 |

### Track B — Skill Prompt 优化 (Phase 1+, iterative)

- **Primary**: `geometry-problem-figure/SKILL.md`, `geometry-solution-figure/SKILL.md`
- **Secondary**: `geometry-problem-figure/references/*.md`

## Target

几何配图在 10 题 benchmark 上达到 **85+** 分。

## Session Template

`solution.json` 已有 `geometry` session template：
```json
"geometry": {
  "description": "几何图形生成模式",
  "enabledSkills": ["geometry-problem-figure", "geometry-solution-figure"]
}
```

## API Invocation

- **Endpoint**: `POST {CCAAS_URL}/api/v1/sessions/{sessionId}/messages`
- **Template**: `geometry`
- **TenantId**: `quiz-analyzer`
- **Message**: 直接发送几何题目内容

## Frozen Constraints

1. **不修改 MCP 工具代码**（write_output 等实现不变）
2. **Phase 0 只修改 GeometryFigure.tsx 和 schemas.ts**（修 bug，不改功能）
3. **Phase 1+ 只修改 SKILL.md 文件**（不改渲染器、不改 schema）
4. **保持 SKILL.md 结构**（Step 1-4 框架、reference file 协议）
5. **中文输出**
6. **每轮修改幅度 ≤ 30%**

## Eval Dimensions (7 维度, 100 分)

| # | Dimension | Weight | Detection |
|---|-----------|--------|-----------|
| D1 | JSON Schema Validity | 15 | Zod safeParse |
| D2 | Element Reference Integrity | 20 | 构建 ID 集合，校验 parents |
| D3 | Geometric Correctness | 25 | AI 判断 elements 是否匹配题意 |
| D4 | Bbox Quality | 10 | x/y 比例 + padding 检查 |
| D5 | Visual Polish | 10 | labels, highlight:false, visible:false |
| D6 | Animation Quality | 15 | range/default/snapValues/autoPlay |
| D7 | Construction Element Usage | 5 | 派生点是否用构造而非 hardcode |

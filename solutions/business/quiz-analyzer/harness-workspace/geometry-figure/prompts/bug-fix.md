# Bug Fix Agent — GeometryFigure.tsx + schemas.ts

## 角色

你是一位 React/TypeScript 开发者，负责修复 GeometryFigure 渲染器的 4 个已知 bug。

## Bug 清单

### Bug 1: evalExpr 缺少 Math scope 预处理

**文件**: `frontend/src/components/GeometryFigure.tsx` lines 22-29
**症状**: 当 SKILL.md 中生成的 expr 使用 `sin(x)` 而非 `Math.sin(x)` 时，`new Function()` 抛出 ReferenceError。
**根因**: 虽然 Math 作为参数传入，但 expr 中的裸函数名 `sin(x)` 不会自动映射到 `Math.sin(x)`。

**Fix**:
在 `evalExpr` 函数中，执行前对 expr 做预处理：为以下函数前缀 `Math.`：
`sin, cos, tan, asin, acos, atan, atan2, sqrt, abs, pow, log, ceil, floor, round, min, max, PI, E`

注意：
- 只替换裸名（不在 `Math.` 之后的）
- 用正则 `(?<![.\w])` 前缀避免替换已有 `Math.sin` 中的 sin
- PI → Math.PI, E → Math.E（但不替换变量名中的 E，如 "xE" 或 "element"）

```typescript
const MATH_NAMES = 'sin|cos|tan|asin|acos|atan|atan2|sqrt|abs|pow|log|ceil|floor|round|min|max|PI|E'
const MATH_RE = new RegExp(`(?<![.\\w])(${MATH_NAMES})(?=\\s*[(]|(?=[^(a-zA-Z]))`, 'g')

function prefixMath(expr: string): string {
  return expr.replace(MATH_RE, 'Math.$1')
}
```

在 `evalExpr` 中调用 `prefixMath(expr)` 处理表达式。

---

### Bug 2: resolveParent 找不到 ID 时静默传递字符串

**文件**: `frontend/src/components/GeometryFigure.tsx` lines 43-47
**症状**: 当 parent 引用不存在的 ID 时，resolveParent 返回字符串本身，JSXGraph 收到字符串而非 object，导致异常或错误渲染。
**根因**: line 47 将未找到的 ID 当作 literal value 返回。

**Fix**:
在 registry 查找失败时，区分两种情况：
1. 看起来像 element ID 的字符串（通常是大写字母或有含义的 ID，不是纯数字/文本） → `console.warn` + return `undefined`
2. 看起来像字面量值（纯数字字符串、文本内容）→ 保持原行为

实际上，更安全的做法是：添加一个 `console.warn` 并返回 `p`（保持不崩溃），但在 `replayElements` 中，如果 `resolveParent` 返回的 parents 中有 `undefined`，就跳过创建该 element。

```typescript
if (typeof p === 'string') {
  const el = registry.get(p)
  if (el) return el
  // ID-like string not found in registry — likely a broken reference
  console.warn(`GeometryFigure: parent "${p}" not found in registry, skipping`)
  return undefined
}
```

在 `replayElements` 中（line 385），添加 check：
```typescript
let parents = exp.parents.map(p => resolveParent(p, registry, paramName, paramRef))
// Skip element if any parent reference is broken (undefined)
if (parents.some(p => p === undefined)) {
  console.warn(`GeometryFigure: skipping element type="${exp.type}" id="${exp.id ?? '(none)'}" due to unresolved parent`)
  continue
}
```

---

### Bug 3: expandElement 解构 parents 时不检查长度

**文件**: `frontend/src/components/GeometryFigure.tsx` lines 317-368
**症状**: incenter/circumcenter/orthocenter/centroid 期望 3 个 parents，但如果 LLM 生成了错误数量的 parents（如 2 或 4），解构 `[A, B, C]` 会导致 undefined。
**根因**: 没有 guard parents.length !== 3。

**Fix**:
在每个 case 分支开头添加 guard：

```typescript
case 'incenter': {
  if ((el.parents as string[]).length !== 3) {
    console.warn(`GeometryFigure: ${el.type} expects 3 parents, got ${el.parents.length}, passing through`)
    return [el]
  }
  const [A, B, C] = el.parents as string[]
  // ... rest unchanged
}
```

对 circumcenter、orthocenter、centroid 也添加相同的 guard。

---

### Bug 4: animation range[0] >= range[1] 时 slider 无效

**文件**: `GeometryFigure.tsx:129` + `schemas.ts:97`
**症状**: 当 LLM 生成 `range: [179, 1]`（反转）时，step 为负、slider min > max。

**Fix (Component)**:
在 `startAnimation` 中（line 125-129），normalize range：
```typescript
const rawRange = anim.range
const range = rawRange[0] < rawRange[1] ? rawRange : [rawRange[1], rawRange[0]] as [number, number]
```

在 slider input（line 197-198），也做同样处理：
```typescript
min={Math.min(anim.range[0], anim.range[1])}
max={Math.max(anim.range[0], anim.range[1])}
```

**Fix (Schema)**:
在 `schemas.ts` 的 `AnimationSpecSchema` 中，添加 refine：
```typescript
range: z.tuple([z.number(), z.number()]).refine(
  ([a, b]) => a < b,
  { message: 'animation range[0] must be less than range[1]' }
),
```

## 验证

修复完成后：
1. `cd solutions/business/quiz-analyzer/frontend && npx tsc --noEmit` — 确认无类型错误
2. 目视检查 diff 是否只包含预期修改
